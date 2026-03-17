"""Helper functions for Airflow tasks"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import json
import base64
import hashlib
import re
from urllib.parse import urlparse

import firebase_admin
from firebase_admin import credentials, firestore
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

logger = logging.getLogger(__name__)


# ===========================================
# DATABASE CONNECTIONS
# ===========================================

def get_revai_db():
    """Get PostgreSQL connection for RevAI database"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            parsed = urlparse(database_url)
            if parsed.hostname in ('localhost', '127.0.0.1'):
                database_url = database_url.replace(parsed.hostname, os.getenv('POSTGRES_HOST', 'revai-postgres'), 1)
            return psycopg2.connect(database_url)

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
        try:
            firebase_admin.get_app()
        except ValueError:
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
    """Decrypt OAuth token using the same CryptoJS/OpenSSL format as the app."""
    try:
        encryption_key = os.getenv('ENCRYPTION_KEY', '')
        if not encryption_key:
            raise ValueError('ENCRYPTION_KEY is not configured')

        encrypted_bytes = base64.b64decode(token_encrypted)
        if not encrypted_bytes.startswith(b'Salted__'):
            raise ValueError('Unsupported encrypted token format')

        salt = encrypted_bytes[8:16]
        ciphertext = encrypted_bytes[16:]

        # The Next.js app passes the env value to CryptoJS as a passphrase string,
        # even when it looks like a hex key. Mirror that behavior exactly here.
        password = encryption_key.encode('utf-8')
        key, iv = _evp_bytes_to_key(password, salt, 32, 16)

        cipher = AES.new(key, AES.MODE_CBC, iv)
        token_decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size).decode('utf-8')
        return token_decrypted
    except Exception as e:
        logger.error(f"Failed to decrypt token: {e}")
        raise


def _evp_bytes_to_key(password: bytes, salt: bytes, key_length: int, iv_length: int):
    """OpenSSL EVP_BytesToKey implementation compatible with CryptoJS passphrase AES."""
    derived = b''
    block = b''

    while len(derived) < (key_length + iv_length):
        block = hashlib.md5(block + password + salt).digest()
        derived += block

    return derived[:key_length], derived[key_length:key_length + iv_length]


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
                LOWER(mc.platform::text) as platform,
                mc."platformContentId",
                mc.title,
                mc."isMonitored",
                c.id as "connectionId",
                c."accessToken",
                c."refreshToken"
            FROM monitored_content mc
            JOIN connections c ON c."userId" = mc."userId" AND c.platform = mc.platform
            WHERE mc."isMonitored" = true
        """
        
        params = []
        if platform:
            query += " AND mc.platform = %s"
            params.append(platform.upper())
        
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
            'SELECT * FROM users WHERE id = %s',
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

        cursor.execute("""
            SELECT "repliesThisHour", "repliesToday"
            FROM rate_limits
            WHERE "userId" = %s
        """, [user_id])
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        return {
            'repliesThisHour': result.get('repliesThisHour', 0) if result else 0,
            'repliesThisDay': result.get('repliesToday', 0) if result else 0,
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
            INSERT INTO rate_limits ("id", "userId", "repliesToday", "repliesThisHour", "lastReset", "createdAt", "updatedAt")
            VALUES (md5(random()::text || clock_timestamp()::text), %s, 1, 1, %s, %s, %s)
            ON CONFLICT ("userId")
            DO UPDATE SET
                "repliesToday" = rate_limits."repliesToday" + 1,
                "repliesThisHour" = rate_limits."repliesThisHour" + 1,
                "updatedAt" = EXCLUDED."updatedAt"
        """, [user_id, datetime.now(), datetime.now(), datetime.now()])
        
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
            SELECT "accessToken" FROM connections
            WHERE "userId" = %s AND platform = %s
        """, [user_id, platform.upper()])
        
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
        doc_id = f"{comment_data.get('platform')}_{comment_data.get('id')}"
        
        doc_data = {
            'userId': user_id,
            'connectionId': comment_data.get('connectionId'),
            'platformCommentId': comment_data.get('id'),
            'platform': comment_data.get('platform'),
            'text': comment_data.get('text'),
            'author': comment_data.get('author', {}),
            'contentId': comment_data.get('contentId'),
            'status': comment_data.get('status', 'pending'),
            'publishedAt': comment_data.get('publishedAt'),
            'fetchedAt': datetime.now(),
            'updatedAt': datetime.now(),
        }
        
        db.collection('comments').document(doc_id).set(doc_data, merge=True)
    except Exception as e:
        logger.error(f"Failed to save comment to Firestore: {e}")
        raise


def fetch_youtube_comments(access_token: str, video_id: str) -> List[Dict[str, Any]]:
    """Fetch real YouTube comments for a video."""
    response = requests.get(
        'https://youtube.googleapis.com/youtube/v3/commentThreads',
        headers={'Authorization': f'Bearer {access_token}'},
        params={
            'part': 'snippet',
            'videoId': video_id,
            'maxResults': 100,
            'order': 'time',
        },
        timeout=30,
    )
    response.raise_for_status()

    items = response.json().get('items', [])
    comments = []
    for item in items:
        snippet = item.get('snippet', {}).get('topLevelComment', {}).get('snippet', {})
        comment_id = item.get('snippet', {}).get('topLevelComment', {}).get('id')
        if not comment_id:
            continue

        comments.append({
            'id': comment_id,
            'text': snippet.get('textDisplay', ''),
            'author': {
                'name': snippet.get('authorDisplayName', 'Unknown'),
                'profileUrl': snippet.get('authorChannelUrl'),
                'avatarUrl': snippet.get('authorProfileImageUrl'),
            },
            'publishedAt': snippet.get('publishedAt'),
        })

    return comments


def fetch_instagram_comments(access_token: str, media_id: str) -> List[Dict[str, Any]]:
    """Fetch real Instagram comments for a media item."""
    response = requests.get(
        f'https://graph.facebook.com/v18.0/{media_id}/comments',
        params={
            'fields': 'id,text,username,timestamp',
            'access_token': access_token,
            'limit': 100,
        },
        timeout=30,
    )
    response.raise_for_status()

    items = response.json().get('data', [])
    return [
        {
            'id': item.get('id'),
            'text': item.get('text', ''),
            'author': {
                'name': item.get('username', 'Unknown'),
            },
            'publishedAt': item.get('timestamp'),
        }
        for item in items if item.get('id')
    ]


def post_youtube_reply(access_token: str, parent_id: str, text: str) -> Dict[str, Any]:
    """Post a real reply to a YouTube comment."""
    response = requests.post(
        'https://youtube.googleapis.com/youtube/v3/comments',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
        params={'part': 'snippet'},
        json={
            'snippet': {
                'parentId': parent_id,
                'textOriginal': text,
            }
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def post_instagram_reply(access_token: str, comment_id: str, text: str) -> Dict[str, Any]:
    """Post a real reply to an Instagram comment."""
    response = requests.post(
        f'https://graph.facebook.com/v18.0/{comment_id}/replies',
        data={
            'message': text,
            'access_token': access_token,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def classify_comment_with_gemini(comment_text: str) -> Dict[str, Any]:
    """Classify a comment using Gemini REST API."""
    prompt = f"""
Analyze this social media comment and return only valid JSON:
{{
  "type": "question|complaint|praise|spam|general",
  "confidence": 0-100,
  "hasSensitiveKeywords": true,
  "keywords": [],
  "sentiment": "positive|negative|neutral"
}}

Comment: "{comment_text}"
"""
    response_text = _generate_gemini_text(prompt)
    parsed = _extract_json_object(response_text)
    return {
        'type': parsed.get('type', 'general'),
        'confidence': max(0, min(100, int(parsed.get('confidence', 50)))),
        'hasSensitiveKeywords': bool(parsed.get('hasSensitiveKeywords', False)),
        'keywords': parsed.get('keywords', []) if isinstance(parsed.get('keywords', []), list) else [],
        'sentiment': parsed.get('sentiment', 'neutral'),
    }


def generate_reply_with_gemini(comment_text: str, comment_type: str, business_context: str = '', tone: str = 'friendly', max_length: int = 500) -> str:
    """Generate a reply using Gemini REST API."""
    prompt = f"""
Generate a concise social media reply.
Return only the reply text.

Comment: "{comment_text}"
Comment Type: {comment_type}
Business Context: {business_context}
Tone: {tone}
Maximum Length: {max_length}
"""
    response_text = _generate_gemini_text(prompt).strip()
    if len(response_text) > max_length:
        return response_text[:max_length - 3] + '...'
    return response_text


def _generate_gemini_text(prompt: str) -> str:
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key or api_key == 'your-gemini-api-key':
        raise ValueError('GEMINI_API_KEY is not configured for real AI processing')

    model_candidates = [
        os.getenv('GEMINI_MODEL'),
        'gemini-2.5-flash',
        'gemini-2.0-flash',
    ]

    last_error = None
    for model in [candidate for candidate in model_candidates if candidate]:
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}',
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [
                    {
                        'parts': [{'text': prompt}]
                    }
                ]
            },
            timeout=60,
        )

        if response.status_code == 404:
            last_error = ValueError(f'Model {model} is not available for generateContent')
            continue

        response.raise_for_status()
        data = response.json()
        candidates = data.get('candidates', [])
        if not candidates:
            raise ValueError('Gemini returned no candidates')

        parts = candidates[0].get('content', {}).get('parts', [])
        return ''.join(part.get('text', '') for part in parts).strip()

    raise last_error or ValueError('No supported Gemini model succeeded')


def _extract_json_object(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


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
