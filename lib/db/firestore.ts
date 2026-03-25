import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export const firestore = admin.firestore()
export const auth = admin.auth()

// Helper functions for common Firestore operations
export class FirestoreService {
  private db = firestore

  // Comments collection operations
  async saveComment(commentData: {
    userId: string
    connectionId: string
    contentId: string
    platform: string
    platformCommentId: string
    text: string
    author: {
      name: string
      profileUrl?: string
      avatarUrl?: string
    }
    publishedAt: Date
    status?: string
  }) {
    const docRef = this.db.collection('comments').doc()
    await docRef.set({
      ...commentData,
      id: docRef.id,
      status: commentData.status || 'pending',
      fetchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return docRef.id
  }

  async getPendingComments(limit = 100) {
    const snapshot = await this.db
      .collection('comments')
      .where('status', '==', 'pending')
      .limit(limit)
      .get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  async updateCommentStatus(commentId: string, status: string, additionalData?: any) {
    await this.db.collection('comments').doc(commentId).update({
      status,
      ...additionalData,
      updatedAt: new Date(),
    })
  }

  // Reports collection operations
  async saveReport(reportData: {
    userId: string
    period: {
      startDate: Date
      endDate: Date
    }
    metrics: any
    insights: any
    generatedAt?: Date
    generatedBy?: string
  }) {
    const docRef = this.db.collection('reports').doc()
    await docRef.set({
      ...reportData,
      id: docRef.id,
      generatedAt: reportData.generatedAt || new Date(),
      generatedBy: reportData.generatedBy || 'system',
      createdAt: new Date(),
    })
    return docRef.id
  }

  async getUserReports(userId: string, limit = 50) {
    const snapshot = await this.db
      .collection('reports')
      .where('userId', '==', userId)
      .orderBy('generatedAt', 'desc')
      .limit(limit)
      .get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  // Generic collection operations
  async getCollection(collectionName: string, filters?: any[], limit = 100) {
    let query: FirebaseFirestore.Query = this.db.collection(collectionName)

    if (filters) {
      filters.forEach(filter => {
        query = query.where(filter.field, filter.operator, filter.value)
      })
    }

    const snapshot = await query.limit(limit).get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  async updateDocument(collectionName: string, docId: string, data: any) {
    await this.db.collection(collectionName).doc(docId).update({
      ...data,
      updatedAt: new Date(),
    })
  }

  async deleteDocument(collectionName: string, docId: string) {
    await this.db.collection(collectionName).doc(docId).delete()
  }
}

export const firestoreService = new FirestoreService()
