// src/push/push.service.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

export class PushService {
  constructor() {
    const serviceAccountPath = path.resolve(__dirname, 'firebase-service.json');

    console.log('📁 Checking serviceAccountPath:', serviceAccountPath);

    if (!admin.apps.length) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        console.log('✅ Firebase Admin initialized from', serviceAccountPath);
      } catch (e) {
        console.error('❌ Firebase init failed:', e.message);
      }
    }
  }

  async sendGenericPush(toToken: string, data: { title: string, body: string }) {
    const message = {
      notification: {
        title: data.title,
        body: data.body,
      },
      token: toToken,
    };

    return await admin.messaging().send(message);
  }
}


