"""Helper functions for Airflow tasks"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import json

import firebase_admin
from firebase_admin import credentials, firestore
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


# ===========================================
# DATABASE CONNECTIONS
# ===========================================

def get_revai_db():
    """Get PostgreSQL connection for RevAI database"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'revai-postgres'),
            port=int(os.getenv('POSTGRES_PORT', 5432)),
            database=os.getenv('POSTGRES_DB', 'revai'),
            user=os.getenv('POSTGRES_USER', 'revai'),
            password=os.getenv('POSTGRES_PASSWORD', 'revai123')
        )
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to RevAI database: {e}")
        raise


def get_firestore_db():
    """Get Firestore connection"""
    try:
        if not firebase_admin.get_app():
            firebase_credentials = {
                'type': 'service_account',
                'project_id': os.getenv('FIREBASE_PROJECT_ID'),
                'private_key_id': os.getenv('FIREBASE_PRIVATE_KEY_ID'),
                'private_key': os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
                'client_email': os.getenv('FIREBASE_CLIENT_EMAIL'),
                'client_id': os.getenv('FIREBASE_CLIENT_ID'),
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
            }
            cred = credentials.Certificate(firebase_credentials)
            firebase_admin.initialize_app(cred)
        
        return firestore.client()
    except Exception as e:
        logger.error(f"Failed to connect to Firestore: {e}")
        raise


# ===========================================
# ENCRYPTION / DECRYPTION
# ===========================================

def decrypt_token(token_encrypted: str) -> str:
    """Decrypt OAuth token using AES-256"""
    from cryptography.fernet import Fernet
    
    try:
        encryption_key = os.getenv('ENCRYPTION_KEY', '').encode()
        cipher = Fernet(encryption_key)
        token_decrypted = cipher.decrypt(token_encrypted.encode()).decode()
        return token_decrypted
    except Exception as e:
        logger.error(f"Failed to decrypt token: {e}")
        raise


# ===========================================
# POSTGRESQL QUERIES
# ===========================================

def get_monitored_content(platform: str = None) -> List[Dict[str, Any]]:
    """Get monitored content for a platform (youtube or instagram)
    
    Args:
        platform: 'youtube' or 'instagram' or None for all
    
    Returns:
        List of monitored content with userId and platformContentId
    """
    try:
        conn = get_revai_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                mc.id,
                mc."userId",
                mc.platform,
                mc."platformContentId",
                mc."platformContentTitle",
                mc."isMonitored",
                c."accessToken",
                c."refreshToken"
            FROM "MonitoredContent" mc
            JOIN "Connection" c ON c."userId" = mc."userId" AND c.platform = mc.platform
            WHERE mc."isMonitored" = true
        """
        
        params = []
        if platform:
            query += " AND mc.platform = %s"
            params.append(platform)
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Failed to get monitored content: {e}")
        raise


def get_user_settings(user_id: str) -> Dict[str, Any]:
    """Get user AI settings from PostgreSQL"""
    try:
        conn = get_revai_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            'SELECT * FROM "User" WHERE id = %s',
            [user_id]
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        return {
            'businessContext': user.get('businessContext', ''),
            'aiTone': user.get('aiTone', 'professional'),
            'autoReplyEnabled': user.get('autoReplyEnabled', False),
            'maxRepliesPerHour': user.get('maxRepliesPerHour', 30),
            'replyDelay': user.get('replyDelay', 0),
        }
    except Exception as e:
        logger.error(f"Failed to get user settings: {e}")
        raise


def get_rate_limit(user_id: str) -> Dict[str, Any]:
    """Get current rate limit counters for user"""
    try:
        conn = get_revai_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get current hour and day
        now = datetime.now()
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        cursor.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE "postedAt" >= %s) as replies_this_hour,
                COUNT(*) FILTER (WHERE "postedAt" >= %s) as replies_this_day
            FROM "Reply"
            WHERE "userId" = %s AND "status" = 'replied'
        """, [hour_start, day_start, user_id])
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        return {
            'repliesThisHour': result.get('replies_this_hour', 0) if result else 0,
            'repliesThisDay': result.get('replies_this_day', 0) if result else 0,
        }
    except Exception as e:
        logger.error(f"Failed to get rate limit: {e}")
        raise


def increment_rate_limit(user_id: str, platform: str):
    """Increment rate limit counter after posting"""
    try:
        conn = get_revai_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO "Reply" ("userId", "commentId", "text", "platform", "status", "postedAt")
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, [user_id, None, '', platform, 'replied', datetime.now()])
        
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to increment rate limit: {e}")
        # Don't raise - this is non-critical


# ===========================================
# FIRESTORE QUERIES
# ===========================================

def get_pending_comments(limit: int = 100) -> List[Dict[str, Any]]:
    """Get pending comments from Firestore"""
    try:
        db = get_firestore_db()
        docs = db.collection('comments').where(
            'status', '==', 'pending'
        ).limit(limit).stream()
        
        comments = []
        for doc in docs:
            data = doc.to_dict()
            data['_doc_ref'] = doc.reference  # Store reference for updates
            comments.append(data)
        
        return comments
    except Exception as e:
        logger.error(f"Failed to get pending comments: {e}")
        raise


def get_classified_comments(limit: int = 100) -> List[Dict[str, Any]]:
    """Get classified comments ready for reply generation"""
    try:
        db = get_firestore_db()
        docs = db.collection('comments').where(
            'status', '==', 'classified'
        ).limit(limit).stream()
        
        comments = []
        for doc in docs:
            data = doc.to_dict()
            data['_doc_ref'] = doc.reference
            comments.append(data)
        
        return comments
    except Exception as e:
        logger.error(f"Failed to get classified comments: {e}")
        raise


def get_ready_to_post_comments(platform: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get comments ready to be posted"""
    try:
        db = get_firestore_db()
        query = db.collection('comments').where('status', '==', 'ready_to_post')
        
        if platform:
            query = query.where('platform', '==', platform)
        
        docs = query.limit(limit).stream()
        
        comments = []
        for doc in docs:
            data = doc.to_dict()
            data['_doc_ref'] = doc.reference
            comments.append(data)
        
        return comments
    except Exception as e:
        logger.error(f"Failed to get ready-to-post comments: {e}")
        raise


def update_comment_status(doc_ref, status: str, extra_data: Dict[str, Any] = None):
    """Update comment status in Firestore"""
    try:
        update_data = {
            'status': status,
            'updatedAt': datetime.now()
        }
        
        if extra_data:
            update_data.update(extra_data)
        
        doc_ref.update(update_data)
    except Exception as e:
        logger.error(f"Failed to update comment status: {e}")
        raise


# ===========================================
# API HELPERS
# ===========================================

def get_decrypted_token(user_id: str, platform: str) -> str:
    """Get and decrypt OAuth token for user on platform"""
    try:
        conn = get_revai_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT "accessToken" FROM "Connection"
            WHERE "userId" = %s AND platform = %s
        """, [user_id, platform])
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not result:
            raise ValueError(f"No {platform} connection for user {user_id}")
        
        token_encrypted = result['accessToken']
        token = decrypt_token(token_encrypted)
        
        return token
    except Exception as e:
        logger.error(f"Failed to get decrypted token: {e}")
        raise


def save_comment_to_firestore(user_id: str, comment_data: Dict[str, Any]):
    """Save a comment to Firestore"""
    try:
        db = get_firestore_db()
        
        doc_data = {
            'userId': user_id,
            'platformCommentId': comment_data.get('id'),
            'platform': comment_data.get('platform'),
            'text': comment_data.get('text'),
            'authorId': comment_data.get('authorId'),
            'contentId': comment_data.get('contentId'),
            'status': 'pending',
            'fetchedAt': datetime.now(),
        }
        
        db.collection('comments').add(doc_data)
    except Exception as e:
        logger.error(f"Failed to save comment to Firestore: {e}")
        raise


# ===========================================
# LOGGING
# ===========================================

def log_task_start(task_name: str):
    """Log task start"""
    logger.info(f"{'='*60}")
    logger.info(f"Starting task: {task_name}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"{'='*60}")


def log_task_end(task_name: str, status: str = 'success'):
    """Log task end"""
    logger.info(f"{'='*60}")
    logger.info(f"Completed task: {task_name}")
    logger.info(f"Status: {status}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"{'='*60}")
