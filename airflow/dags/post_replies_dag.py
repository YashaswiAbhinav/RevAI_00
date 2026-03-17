"""
Post Replies DAG
Runs every 15 minutes to post approved replies to YouTube and Instagram
"""

from datetime import datetime, timedelta
import logging
import time
import random
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
import sys
sys.path.insert(0, '/opt/airflow')

# Read interval from Airflow Variable set by the settings page (default 15 min)
_post_interval = int(Variable.get('revai_post_interval_minutes', default_var=15))
_schedule = f'*/{_post_interval} * * * *' if _post_interval < 60 else f'0 */{_post_interval // 60} * * *'

# Import helper functions
from tasks.helpers import (
    get_ready_to_post_comments,
    get_rate_limit,
    get_decrypted_token,
    update_comment_status,
    increment_rate_limit,
    post_youtube_reply,
    post_instagram_reply,
    log_task_start,
    log_task_end
)

logger = logging.getLogger(__name__)

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
    'post_replies_dag',
    default_args=default_args,
    description='Post approved replies to YouTube and Instagram',
    schedule_interval=_schedule,
    catchup=False,
    tags=['revai', 'comments', 'posting'],
)


# ===========================================
# TASK: Post to YouTube
# ===========================================

def task_post_to_youtube(**context):
    """Post replies to YouTube comments"""
    log_task_start('post_to_youtube')
    
    try:
        # Get ready-to-post comments for YouTube
        ready_comments = get_ready_to_post_comments('youtube', limit=50)
        logger.info(f"Found {len(ready_comments)} YouTube comments ready to post")
        
        posted_count = 0
        failed_count = 0
        
        for comment in ready_comments:
            try:
                user_id = comment['userId']
                platform_comment_id = comment['platformCommentId']
                reply_text = comment['generatedReply']['text']
                
                # Check rate limit
                rate_limit = get_rate_limit(user_id)
                if rate_limit['repliesThisHour'] >= 30:
                    logger.warning(f"User {user_id} hit hourly rate limit, skipping")
                    continue
                
                token = get_decrypted_token(user_id, 'youtube')
                logger.info(f"Posting reply to YouTube comment {platform_comment_id}")
                result = post_youtube_reply(token, platform_comment_id, reply_text)
                
                # Update comment status in Firestore
                update_comment_status(
                    comment['_doc_ref'],
                    'replied',
                    {
                        'posted': {
                            'isPosted': True,
                            'postedAt': datetime.now(),
                            'platformReplyId': result.get('id'),
                            'platform': 'youtube'
                        }
                    }
                )
                
                # Increment rate limit
                increment_rate_limit(user_id, 'youtube')
                
                wait_time = random.randint(2, 5)
                logger.info(f"Waiting {wait_time} seconds before next post...")
                time.sleep(wait_time)
                
                posted_count += 1
                
            except Exception as e:
                logger.error(f"Error posting YouTube reply: {e}")
                
                # Update with error status
                try:
                    update_comment_status(
                        comment['_doc_ref'],
                        'failed',
                        {'error': str(e), 'platform': 'youtube'}
                    )
                except:
                    pass
                
                failed_count += 1
                continue
        
        logger.info(f"YouTube posting results: {posted_count} posted, {failed_count} failed")
        context['task_instance'].xcom_push(key='youtube_posted', value=posted_count)
        
        log_task_end('post_to_youtube', 'success')
        return posted_count
    except Exception as e:
        logger.error(f"Error in post_to_youtube: {e}")
        log_task_end('post_to_youtube', 'failed')
        raise


# ===========================================
# TASK: Post to Instagram
# ===========================================

def task_post_to_instagram(**context):
    """Post replies to Instagram comments"""
    log_task_start('post_to_instagram')
    
    try:
        # Get ready-to-post comments for Instagram
        ready_comments = get_ready_to_post_comments('instagram', limit=50)
        logger.info(f"Found {len(ready_comments)} Instagram comments ready to post")
        
        posted_count = 0
        failed_count = 0
        
        for comment in ready_comments:
            try:
                user_id = comment['userId']
                platform_comment_id = comment['platformCommentId']
                reply_text = comment['generatedReply']['text']
                
                # Check rate limit
                rate_limit = get_rate_limit(user_id)
                if rate_limit['repliesThisHour'] >= 30:
                    logger.warning(f"User {user_id} hit hourly rate limit, skipping")
                    continue
                
                token = get_decrypted_token(user_id, 'instagram')
                logger.info(f"Posting reply to Instagram comment {platform_comment_id}")
                result = post_instagram_reply(token, platform_comment_id, reply_text)
                
                # Update comment status in Firestore
                update_comment_status(
                    comment['_doc_ref'],
                    'replied',
                    {
                        'posted': {
                            'isPosted': True,
                            'postedAt': datetime.now(),
                            'platformReplyId': result.get('id'),
                            'platform': 'instagram'
                        }
                    }
                )
                
                # Increment rate limit
                increment_rate_limit(user_id, 'instagram')
                
                wait_time = random.randint(2, 5)
                logger.info(f"Waiting {wait_time} seconds before next post...")
                time.sleep(wait_time)
                
                posted_count += 1
                
            except Exception as e:
                logger.error(f"Error posting Instagram reply: {e}")
                
                # Update with error status
                try:
                    update_comment_status(
                        comment['_doc_ref'],
                        'failed',
                        {'error': str(e), 'platform': 'instagram'}
                    )
                except:
                    pass
                
                failed_count += 1
                continue
        
        logger.info(f"Instagram posting results: {posted_count} posted, {failed_count} failed")
        context['task_instance'].xcom_push(key='instagram_posted', value=posted_count)
        
        log_task_end('post_to_instagram', 'success')
        return posted_count
    except Exception as e:
        logger.error(f"Error in post_to_instagram: {e}")
        log_task_end('post_to_instagram', 'failed')
        raise


# ===========================================
# TASK: Summary
# ===========================================

def task_post_summary(**context):
    """Summarize posting results"""
    youtube_posted = context['task_instance'].xcom_pull(
        task_ids='post_to_youtube',
        key='youtube_posted'
    ) or 0
    
    instagram_posted = context['task_instance'].xcom_pull(
        task_ids='post_to_instagram',
        key='instagram_posted'
    ) or 0
    
    total = youtube_posted + instagram_posted
    
    logger.info(f"===== POST SUMMARY =====")
    logger.info(f"YouTube replies posted: {youtube_posted}")
    logger.info(f"Instagram replies posted: {instagram_posted}")
    logger.info(f"Total posted: {total}")
    logger.info(f"=======================")


# ===========================================
# DEFINE TASK DEPENDENCIES
# ===========================================

post_to_youtube_task = PythonOperator(
    task_id='post_to_youtube',
    python_callable=task_post_to_youtube,
    dag=dag,
)

post_to_instagram_task = PythonOperator(
    task_id='post_to_instagram',
    python_callable=task_post_to_instagram,
    dag=dag,
)

post_summary_task = PythonOperator(
    task_id='post_summary',
    python_callable=task_post_summary,
    dag=dag,
)

# Set task dependencies - These can run in parallel
[post_to_youtube_task, post_to_instagram_task] >> post_summary_task
