"""
Fetch Comments DAG
Runs every 30 minutes to fetch new comments from monitored content
"""

from datetime import datetime, timedelta
import logging
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
import sys
sys.path.insert(0, '/opt/airflow')

# Import helper functions
from tasks.helpers import (
    get_monitored_content,
    get_decrypted_token,
    save_comment_to_firestore,
    fetch_youtube_comments,
    fetch_instagram_comments,
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
    'fetch_comments_dag',
    default_args=default_args,
    description='Fetch comments from monitored YouTube/Instagram content every 30 minutes',
    schedule_interval='*/30 * * * *',  # Every 30 minutes
    catchup=False,
    tags=['revai', 'comments', 'fetch'],
)


# ===========================================
# TASK: Get Monitored Content
# ===========================================

def task_get_monitored_content(**context):
    """Fetch all monitored YouTube and Instagram content"""
    log_task_start('get_monitored_content')
    
    try:
        monitored = get_monitored_content()
        logger.info(f"Found {len(monitored)} monitored content items")
        
        # Push to XCom for downstream tasks
        context['task_instance'].xcom_push(key='monitored_content', value=monitored)
        
        log_task_end('get_monitored_content', 'success')
        return len(monitored)
    except Exception as e:
        logger.error(f"Error in get_monitored_content: {e}")
        log_task_end('get_monitored_content', 'failed')
        raise


# ===========================================
# TASK: Fetch YouTube Comments
# ===========================================

def task_fetch_youtube_comments(**context):
    """Fetch comments from YouTube API for monitored videos"""
    log_task_start('fetch_youtube_comments')
    
    try:
        monitored = context['task_instance'].xcom_pull(
            task_ids='get_monitored_content',
            key='monitored_content'
        )
        
        youtube_content = [c for c in monitored if c['platform'] == 'youtube']
        logger.info(f"Processing {len(youtube_content)} YouTube videos")
        
        comments_fetched = 0
        
        for content in youtube_content:
            try:
                user_id = content['userId']
                video_id = content['platformContentId']
                
                token = get_decrypted_token(user_id, 'youtube')
                comments = fetch_youtube_comments(token, video_id)

                for comment in comments:
                    save_comment_to_firestore(user_id, {
                        'id': comment['id'],
                        'connectionId': content.get('connectionId'),
                        'platform': 'youtube',
                        'text': comment['text'],
                        'author': comment['author'],
                        'contentId': video_id,
                        'publishedAt': comment.get('publishedAt'),
                    })
                    comments_fetched += 1
                
            except Exception as e:
                logger.error(f"Error fetching comments for video {video_id}: {e}")
                continue
        
        logger.info(f"Successfully fetched {comments_fetched} YouTube comments")
        context['task_instance'].xcom_push(key='youtube_comments', value=comments_fetched)
        
        log_task_end('fetch_youtube_comments', 'success')
        return comments_fetched
    except Exception as e:
        logger.error(f"Error in fetch_youtube_comments: {e}")
        log_task_end('fetch_youtube_comments', 'failed')
        raise


# ===========================================
# TASK: Fetch Instagram Comments
# ===========================================

def task_fetch_instagram_comments(**context):
    """Fetch comments from Instagram API for monitored posts"""
    log_task_start('fetch_instagram_comments')
    
    try:
        monitored = context['task_instance'].xcom_pull(
            task_ids='get_monitored_content',
            key='monitored_content'
        )
        
        instagram_content = [c for c in monitored if c['platform'] == 'instagram']
        logger.info(f"Processing {len(instagram_content)} Instagram posts")
        
        comments_fetched = 0
        
        for content in instagram_content:
            try:
                user_id = content['userId']
                post_id = content['platformContentId']
                
                token = get_decrypted_token(user_id, 'instagram')
                comments = fetch_instagram_comments(token, post_id)

                for comment in comments:
                    save_comment_to_firestore(user_id, {
                        'id': comment['id'],
                        'connectionId': content.get('connectionId'),
                        'platform': 'instagram',
                        'text': comment['text'],
                        'author': comment['author'],
                        'contentId': post_id,
                        'publishedAt': comment.get('publishedAt'),
                    })
                    comments_fetched += 1
                
            except Exception as e:
                logger.error(f"Error fetching comments for post {post_id}: {e}")
                continue
        
        logger.info(f"Successfully fetched {comments_fetched} Instagram comments")
        context['task_instance'].xcom_push(key='instagram_comments', value=comments_fetched)
        
        log_task_end('fetch_instagram_comments', 'success')
        return comments_fetched
    except Exception as e:
        logger.error(f"Error in fetch_instagram_comments: {e}")
        log_task_end('fetch_instagram_comments', 'failed')
        raise


# ===========================================
# TASK: Summary
# ===========================================

def task_fetch_summary(**context):
    """Summarize fetching results"""
    youtube_count = context['task_instance'].xcom_pull(
        task_ids='fetch_youtube_comments',
        key='youtube_comments'
    ) or 0
    
    instagram_count = context['task_instance'].xcom_pull(
        task_ids='fetch_instagram_comments',
        key='instagram_comments'
    ) or 0
    
    total = youtube_count + instagram_count
    logger.info(f"===== FETCH SUMMARY =====")
    logger.info(f"YouTube comments: {youtube_count}")
    logger.info(f"Instagram comments: {instagram_count}")
    logger.info(f"Total fetched: {total}")
    logger.info(f"========================")


# ===========================================
# DEFINE TASK DEPENDENCIES
# ===========================================

get_monitored_content_task = PythonOperator(
    task_id='get_monitored_content',
    python_callable=task_get_monitored_content,
    dag=dag,
)

fetch_youtube_comments_task = PythonOperator(
    task_id='fetch_youtube_comments',
    python_callable=task_fetch_youtube_comments,
    dag=dag,
)

fetch_instagram_comments_task = PythonOperator(
    task_id='fetch_instagram_comments',
    python_callable=task_fetch_instagram_comments,
    dag=dag,
)

fetch_summary_task = PythonOperator(
    task_id='fetch_summary',
    python_callable=task_fetch_summary,
    dag=dag,
)

# Set task dependencies
get_monitored_content_task >> [fetch_youtube_comments_task, fetch_instagram_comments_task] >> fetch_summary_task
