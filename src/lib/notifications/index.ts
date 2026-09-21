import { InAppNotificationService } from './in-app.service';
import { INotificationService, NotificationPayload, NotificationResult } from './notification.interface';
import { PhoneCallNotificationService } from './phone-call.service';
import { TelegramNotificationService } from './telegram.service';
import { WebhookNotificationService } from './webhook.service';
import { WebPushNotificationService } from './web-push.service';

export * from './notification.interface';
export { InAppNotificationService } from './in-app.service';
export { TelegramNotificationService } from './telegram.service';
export { WebhookNotificationService } from './webhook.service';
export { PhoneCallNotificationService } from './phone-call.service';
export { WebPushNotificationService } from './web-push.service';

/**
 * NotificationDispatcher
 *
 * Routes notifications to the correct channel(s) based on DEFAULT_NOTIFICATION_CHANNEL env var.
 *
 * Recommended free channels (in priority order):
 * 1. telegram  — Instant, free, mobile — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 * 2. web_push  — Browser push, free — requires VAPID keys + user permission
 * 3. in_app    — Web UI only (already built, zero config)
 * 4. multi     — Sends to all configured channels simultaneously
 *
 * Paid (modular, available for future use):
 * 5. webhook   — HTTP POST to any URL (n8n, Zapier, etc.)
 * 6. phone_call — Simulated voice call (placeholder for Twilio etc.)
 *
 * In-app is always recorded as the audit trail regardless of channel.
 */
export class NotificationDispatcher implements INotificationService {
  channelName = 'dispatcher';

  private inAppService = new InAppNotificationService();
  private telegramService = new TelegramNotificationService();
  private webhookService = new WebhookNotificationService();
  private phoneCallService = new PhoneCallNotificationService();
  private webPushService = new WebPushNotificationService();

  async sendAlert(payload: NotificationPayload): Promise<NotificationResult> {
    const channel = process.env.DEFAULT_NOTIFICATION_CHANNEL || 'in_app';

    // In-app is always the persistent audit record
    const inAppResult = await this.inAppService.sendAlert(payload);

    if (channel === 'telegram') {
      const tgResult = await this.telegramService.sendAlert(payload);
      return tgResult.success ? tgResult : inAppResult;
    }

    if (channel === 'web_push') {
      const wpResult = await this.webPushService.sendAlert(payload);
      return wpResult.success ? wpResult : inAppResult;
    }

    if (channel === 'webhook') {
      const whResult = await this.webhookService.sendAlert(payload);
      return whResult.success ? whResult : inAppResult;
    }

    if (channel === 'phone_call') {
      const callResult = await this.phoneCallService.sendAlert(payload);
      return callResult.success ? callResult : inAppResult;
    }

    if (channel === 'multi') {
      // Fire all configured external channels in parallel
      // In-app already sent above as primary audit
      const [tgResult, wpResult, whResult] = await Promise.allSettled([
        this.telegramService.sendAlert(payload),
        this.webPushService.sendAlert(payload),
        this.webhookService.sendAlert(payload),
      ]);

      // Return the first successful result, or in-app as fallback
      const firstSuccess = [tgResult, wpResult, whResult].find(
        (r) => r.status === 'fulfilled' && r.value.success
      );
      if (firstSuccess && firstSuccess.status === 'fulfilled') {
        return firstSuccess.value;
      }
      return inAppResult;
    }

    // Default: in_app only
    return inAppResult;
  }
}

export const defaultNotificationService = new NotificationDispatcher();
