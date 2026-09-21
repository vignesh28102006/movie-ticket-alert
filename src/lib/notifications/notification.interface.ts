import { NotificationChannel, PlatformType } from '@/types/database';

export interface NotificationPayload {
  alertId: string;
  userId: string;
  movieTitle: string;
  theatreName: string;
  watchDate: string;
  city: string;
  platform: PlatformType;
  phoneNumber: string;
  /** Optional per-alert Telegram chat ID. Falls back to TELEGRAM_CHAT_ID env var. */
  telegramChatId?: string;
  shows?: Array<{
    showTime: string;
    screenName?: string;
    bookingUrl?: string;
  }>;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel | string;
  messageId?: string;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

export interface INotificationService {
  channelName: string;
  sendAlert(payload: NotificationPayload): Promise<NotificationResult>;
}
