export interface NotificationPayload {
  fromUserId: number;
  toUserId: number;
  fcmToken: string | null;
  type: 'follow'| 'like' | 'comment';
  timestamp: string;
}
