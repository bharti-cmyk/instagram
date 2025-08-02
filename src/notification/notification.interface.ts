export interface NotificationPayload {
  fromUserId: number;
  toUserId: number;
  fcmToken: string | null;
  type: 'follow'| 'like' | 'comment';
  timestamp: string;
  postId?: string; // Optional, only for comment notifications
  text?: string; // Optional, only for comment notifications
}
