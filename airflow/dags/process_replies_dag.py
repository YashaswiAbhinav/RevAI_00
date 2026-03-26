"""
Process Replies DAG
Runs every 1 hour to classify comments and generate AI replies
"""

from datetime import datetime, timedelta
import logging
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
import os
import sys
sys.path.insert(0, '/opt/airflow')

def _load_interval_minutes(variable_name: str, default_minutes: int) -> int:
    try:
        return max(5, int(Variable.get(variable_name, default_var=default_minutes)))
    except (TypeError, ValueError):
        return default_minutes


_process_interval = _load_interval_minutes('revai_process_interval_minutes', 60)
_schedule = timedelta(minutes=_process_interval)

# Import helper functions
from tasks.helpers import (
    get_pending_comments,
    get_classified_comments,
    get_user_settings,
    update_comment_status,
    classify_comment_with_gemini,
    generate_reply_with_gemini,
    evaluate_reply_action,
    is_reply_delay_satisfied,
    is_legacy_fallback_reply,
    log_task_start,
    log_task_end
)

logger = logging.getLogger(__name__)
ACTIVE_GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')

# Default arguments for DAG
default_args = {
    'owner': 'revai',
    'depends_on_past': False,
    'start_date': datetime(2025, 3, 16),
    'email': ['airflow@revai.local'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# Define DAG
dag = DAG(
    'process_replies_dag',
    default_args=default_args,
    description='Classify comments and generate AI replies',
    schedule_interval=_schedule,
    catchup=False,
    tags=['revai', 'comments', 'ai', 'process'],
)


# ===========================================
# TASK: Classify Comments
# ===========================================

def task_classify_comments(**context):
    """Get pending comments and classify them using Gemini API"""
    log_task_start('classify_comments')
    
    try:
        # Get pending comments from Firestore
        pending_comments = get_pending_comments(limit=100)
        logger.info(f"Found {len(pending_comments)} pending comments to classify")
        
        classified_count = 0
        
        for comment in pending_comments:
            try:
                classification = classify_comment_with_gemini(comment['text'])
                
                logger.info(f"Classified comment {comment.get('platformCommentId')}: {classification['sentiment']}")
                
                # Update comment status in Firestore
                update_comment_status(
                    comment['_doc_ref'],
                    'classified',
                    {'classification': classification}
                )
                
                classified_count += 1
                
            except Exception as e:
                logger.error(f"Error classifying comment: {e}")
                continue
        
        logger.info(f"Successfully classified {classified_count} comments")
        context['task_instance'].xcom_push(key='classified_count', value=classified_count)
        
        log_task_end('classify_comments', 'success')
        return classified_count
    except Exception as e:
        logger.error(f"Error in classify_comments: {e}")
        log_task_end('classify_comments', 'failed')
        raise


# ===========================================
# TASK: Generate Replies
# ===========================================

def task_generate_replies(**context):
    """Generate AI replies for classified comments"""
    log_task_start('generate_replies')
    
    try:
        # Get classified comments from Firestore
        classified_comments = get_classified_comments(limit=100)
        logger.info(f"Found {len(classified_comments)} classified comments for reply generation")
        
        generated_count = 0
        
        for comment in classified_comments:
            try:
                user_id = comment['userId']
                comment_text = comment['text']
                
                # Get user settings for personalization
                user_settings = get_user_settings(user_id)
                classification = comment.get('classification', {})
                action = evaluate_reply_action(classification, user_settings)

                if action['status'] == 'rejected':
                    update_comment_status(
                        comment['_doc_ref'],
                        'rejected',
                        {
                            'automation': {
                                'decision': action['reason'],
                                'processedAt': datetime.now(),
                            }
                        }
                    )
                    logger.info(f"Rejected comment {comment.get('platformCommentId')}: {action['reason']}")
                    generated_count += 1
                    continue

                existing_reply = ((comment.get('generatedReply') or {}).get('text')
                                  if isinstance(comment.get('generatedReply'), dict) else None)
                if is_legacy_fallback_reply(existing_reply):
                    existing_reply = None

                reply_text = existing_reply or generate_reply_with_gemini(
                    comment_text=comment_text,
                    comment_type=classification.get('type', 'general'),
                    comment_sentiment=classification.get('sentiment', 'neutral'),
                    business_context=user_settings.get('businessContext') or '',
                    tone=user_settings.get('aiTone') or 'friendly',
                    max_length=user_settings.get('maxReplyLength') or 300,
                )

                next_status = action['status']
                decision_reason = action['reason']

                if next_status == 'ready_to_post' and not is_reply_delay_satisfied(
                    comment,
                    user_settings.get('replyDelay', 0),
                ):
                    next_status = 'classified'
                    decision_reason = 'awaiting_reply_delay'

                logger.info(f"Generated reply for comment {comment.get('platformCommentId')} with status {next_status}")

                update_comment_status(
                    comment['_doc_ref'],
                    next_status,
                    {
                        'generatedReply': {
                            'text': reply_text,
                            'generatedAt': datetime.now(),
                            'model': ACTIVE_GEMINI_MODEL,
                            'userSettings': {
                                'tone': user_settings['aiTone'],
                                'businessContext': user_settings['businessContext']
                            }
                        },
                        'automation': {
                            'decision': decision_reason,
                            'processedAt': datetime.now(),
                        }
                    }
                )
                
                generated_count += 1
                
            except Exception as e:
                logger.error(f"Error generating reply for comment: {e}")
                continue
        
        logger.info(f"Successfully generated {generated_count} replies")
        context['task_instance'].xcom_push(key='generated_count', value=generated_count)
        
        log_task_end('generate_replies', 'success')
        return generated_count
    except Exception as e:
        logger.error(f"Error in generate_replies: {e}")
        log_task_end('generate_replies', 'failed')
        raise


# ===========================================
# TASK: Summary
# ===========================================

def task_process_summary(**context):
    """Summarize processing results"""
    classified_count = context['task_instance'].xcom_pull(
        task_ids='classify_comments',
        key='classified_count'
    ) or 0
    
    generated_count = context['task_instance'].xcom_pull(
        task_ids='generate_replies',
        key='generated_count'
    ) or 0
    
    logger.info(f"===== PROCESS SUMMARY =====")
    logger.info(f"Classified comments: {classified_count}")
    logger.info(f"Replies processed: {generated_count}")
    logger.info(f"=========================")


# ===========================================
# DEFINE TASK DEPENDENCIES
# ===========================================

classify_comments_task = PythonOperator(
    task_id='classify_comments',
    python_callable=task_classify_comments,
    dag=dag,
)

generate_replies_task = PythonOperator(
    task_id='generate_replies',
    python_callable=task_generate_replies,
    dag=dag,
)

process_summary_task = PythonOperator(
    task_id='process_summary',
    python_callable=task_process_summary,
    dag=dag,
)

# Set task dependencies
classify_comments_task >> generate_replies_task >> process_summary_task
