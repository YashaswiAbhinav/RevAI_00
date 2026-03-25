# Apache Airflow Guide

## 🎯 Overview

Airflow orchestrates the automated comment processing pipeline:

1. Fetch comments from platforms
2. Classify with AI
3. Generate replies
4. Post replies back to platforms

## 🏗️ Architecture

**Airflow runs in Docker** with these components:

- **Webserver**: UI at `http://localhost:8080`
- **Scheduler**: Triggers DAGs on schedule
- **Worker**: Executes tasks
- **PostgreSQL**: Stores Airflow metadata (separate from RevAI DB)
- **Redis**: Task queue (if using CeleryExecutor)

## 📂 Project Structure
```
airflow/
├── dags/
│   ├── fetch_comments_dag.py       # DAG 1: Fetch comments
│   ├── process_replies_dag.py      # DAG 2: AI processing
│   └── post_replies_dag.py         # DAG 3: Post replies
├── tasks/
│   ├── youtube_tasks.py            # YouTube API functions
│   ├── reddit_tasks.py             # Reddit API functions
│   ├── instagram_tasks.py          # Instagram API functions
│   ├── ai_tasks.py                 # Gemini AI functions
│   └── posting_tasks.py            # Reply posting functions
└── config/
    └── airflow.cfg                 # Airflow configuration
```

## 🔄 DAG Details

### DAG 1: Fetch Comments (Every 30 minutes)

**File**: `airflow/dags/fetch_comments_dag.py`

**Schedule**: `*/30 * * * *` (every 30 minutes)

**Tasks**:

1. `get_monitored_content` - Query PostgreSQL for monitored videos/posts/submissions
2. `fetch_youtube_comments` - Fetch new comments from YouTube API
3. `fetch_reddit_comments` - Fetch new comments from Reddit API
4. `fetch_instagram_comments` - Fetch new comments from Instagram API
4. `save_to_firestore` - Save comments to Firestore with status "pending"

**Task Flow**:
```
get_monitored_content
    ├─> fetch_youtube_comments ─┐
    ├─> fetch_reddit_comments ──┤
    └─> fetch_instagram_comments─┤
                                  ├─> save_to_firestore
```

**Key Logic**:
```python
def fetch_youtube_comments_task(**context):
    # Get monitored content from PostgreSQL
    monitored = get_monitored_content_for_platform('youtube')
    
    for content in monitored:
        # Get user's connection (decrypt token)
        token = get_decrypted_token(content['userId'], 'youtube')
        
        # Fetch comments from YouTube API
        comments = youtube_api.fetch_comments(
            video_id=content['platformContentId'],
            access_token=token
        )
        
        # Save to Firestore
        for comment in comments:
            # Check if already exists
            existing = firestore_db.collection('comments').where(
                'platformCommentId', '==', comment['id']
            ).get()
            
            if not existing:
                firestore_db.collection('comments').add({
                    'userId': content['userId'],
                    'platformCommentId': comment['id'],
                    'text': comment['text'],
                    'status': 'pending',
                    'fetchedAt': datetime.now()
                })
```

---

### DAG 2: Process Replies (Every 1 hour)

**File**: `airflow/dags/process_replies_dag.py`

**Schedule**: `0 * * * *` (every hour at minute 0)

**Tasks**:

1. `get_pending_comments` - Query Firestore for status="pending"
2. `classify_comments` - Call Gemini API for classification
3. `generate_replies` - Call Gemini API for reply generation
4. `update_firestore` - Update status to "ready_to_post"

**Task Flow**:
```
get_pending_comments -> classify_comments -> generate_replies -> update_firestore
```

**Key Logic**:
```python
def classify_comments_task(**context):
    # Get pending comments from Firestore
    pending_comments = firestore_db.collection('comments').where(
        'status', '==', 'pending'
    ).limit(100).get()
    
    for doc in pending_comments:
        comment = doc.to_dict()
        
        # Call Gemini API for classification
        classification = gemini_api.classify_comment(comment['text'])
        
        # Update Firestore
        doc.reference.update({
            'classification': classification,
            'status': 'classified',
            'processedAt': datetime.now()
        })

def generate_replies_task(**context):
    # Get classified comments
    classified = firestore_db.collection('comments').where(
        'status', '==', 'classified'
    ).limit(100).get()
    
    for doc in classified:
        comment = doc.to_dict()
        
        # Get user's business context from PostgreSQL
        user_settings = get_user_settings(comment['userId'])
        
        # Call Gemini API for reply
        reply = gemini_api.generate_reply(
            comment_text=comment['text'],
            business_context=user_settings['businessContext'],
            tone=user_settings['replyTone']
        )
        
        # Update Firestore
        doc.reference.update({
            'generatedReply': {
                'text': reply,
                'generatedAt': datetime.now(),
                'model': 'gemini-pro'
            },
            'status': 'ready_to_post'
        })
```

---

### DAG 3: Post Replies (Every 15 minutes)

**File**: `airflow/dags/post_replies_dag.py`

**Schedule**: `*/15 * * * *` (every 15 minutes)

**Tasks**:

1. `get_ready_comments` - Query Firestore for status="ready_to_post"
2. `check_rate_limits` - Verify user hasn't exceeded quota
3. `post_to_youtube` - Post replies to YouTube
4. `post_to_reddit` - Post replies to Reddit
5. `post_to_instagram` - Post replies to Instagram
5. `update_rate_limits` - Increment counters in PostgreSQL

**Task Flow**:
```
get_ready_comments -> check_rate_limits ─┬─> post_to_youtube ─┐
                                          ├─> post_to_reddit ──┤
                                          └─> post_to_instagram─┤
                                                                 ├─> update_rate_limits
```

**Key Logic**:
```python
def post_to_youtube_task(**context):
    # Get ready comments for YouTube
    ready = firestore_db.collection('comments').where(
        'status', '==', 'ready_to_post'
    ).where('platform', '==', 'youtube').limit(50).get()
    
    for doc in ready:
        comment = doc.to_dict()
        
        # Check rate limit
        rate_limit = get_rate_limit(comment['userId'], 'youtube')
        if rate_limit['repliesThisHour'] >= 30:
            continue  # Skip, user hit hourly limit
        
        # Get user's token
        token = get_decrypted_token(comment['userId'], 'youtube')
        
        # Post reply to YouTube
        try:
            result = youtube_api.post_reply(
                parent_id=comment['platformCommentId'],
                text=comment['generatedReply']['text'],
                access_token=token
            )
            
            # Update Firestore
            doc.reference.update({
                'status': 'replied',
                'posted': {
                    'isPosted': True,
                    'postedAt': datetime.now(),
                    'platformReplyId': result['id']
                }
            })
            
            # Increment rate limit
            increment_rate_limit(comment['userId'], 'youtube')
            
            # Wait 60-120 seconds (avoid spam detection)
            import random
            time.sleep(random.randint(60, 120))
            
        except Exception as e:
            # Update with error
            doc.reference.update({
                'status': 'failed',
                'error': str(e)
            })
```

---

## 🚀 Running Airflow

### Start Airflow
```bash
# From project root
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f airflow-scheduler
```

### Access Airflow UI

1. Open browser: `http://localhost:8080`
2. Login: `admin` / `admin`
3. You'll see all DAGs listed

### Trigger DAG Manually

1. Click on DAG name
2. Click "Trigger DAG" (play button)
3. Monitor task progress in Graph View

### Stop Airflow
```bash
docker-compose down
```

---

## 🐛 Debugging

### View Task Logs

1. Airflow UI → DAGs → Click DAG name
2. Click on task (colored box)
3. Click "Log" button

Or via command line:
```bash
docker-compose exec airflow-scheduler airflow tasks logs \
  fetch_comments_dag get_monitored_content 2025-03-16
```

### Test Task Locally
```bash
# Enter Airflow container
docker-compose exec airflow-scheduler bash

# Run task
airflow tasks test fetch_comments_dag get_monitored_content 2025-03-16
```

### Common Issues

**DAG not appearing in UI**:
```bash
# Check for Python syntax errors
python airflow/dags/fetch_comments_dag.py

# Restart scheduler
docker-compose restart airflow-scheduler
```

**Task failing with "Connection refused"**:

- Check environment variables are passed to Airflow container
- Verify `docker-compose.yml` has `.env.local` volume mounted

**Firestore permission denied**:

- Ensure Firebase service account key is accessible in Airflow
- Check `FIREBASE_PRIVATE_KEY` has `\n` preserved

---

## 🔧 Configuration

### Environment Variables in Airflow

**File**: `docker-compose.yml`
```yaml
airflow-scheduler:
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
    - FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
    - ENCRYPTION_KEY=${ENCRYPTION_KEY}
  volumes:
    - ./.env.local:/opt/airflow/.env
```

### Task Retry Settings

**In DAG file**:
```python
default_args = {
    'owner': 'revai',
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'email_on_failure': False,
}
```

---

## 📊 Monitoring

### Check DAG Run Status
```bash
# List recent DAG runs
docker-compose exec airflow-scheduler airflow dags list-runs

# Check specific DAG
docker-compose exec airflow-scheduler airflow dags list-runs -d fetch_comments_dag
```

### View Task Duration

Airflow UI → DAGs → Click DAG → "Task Duration" graph

---

## 🎯 Best Practices

1. **Keep tasks idempotent** - Running twice should be safe
2. **Use task retries** - Network issues are common
3. **Add logging** - Use `logging.info()` liberally
4. **Test locally first** - Don't debug in production
5. **Monitor execution time** - Optimize slow tasks

---

**Last Updated**: 2025-03-16
**Airflow Version**: 2.8.0
