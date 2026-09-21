import { INotificationService, NotificationPayload, NotificationResult } from './notification.interface';

/**
 * WebhookNotificationService
 * Sends ticket alert event payload to n8n workflow or any custom webhook receiver.
 */
export class WebhookNotificationService implements INotificationService {
  channelName = 'webhook';

  async sendAlert(payload: NotificationPayload): Promise<NotificationResult> {
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        success: false,
        channel: this.channelName,
        error: 'WEBHOOK_URL environment variable is not configured.',
      };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MovieTicketAlert-Notifier/1.0',
        },
        body: JSON.stringify({
          event: 'TICKETS_RELEASED',
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          channel: this.channelName,
          error: `Webhook returned HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        channel: this.channelName,
        messageId: `wh-${Date.now()}`,
      };
    } catch (err) {
      return {
        success: false,
        channel: this.channelName,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
