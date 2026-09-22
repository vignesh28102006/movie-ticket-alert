import { DataRepository } from '@/lib/db/repo';
import { INotificationService, NotificationPayload, NotificationResult } from './notification.interface';

/**
 * InAppNotificationService
 * Zero-cost default notification provider.
 * Formats the alert message and persists it into the user's notification audit log in the database.
 */
export class InAppNotificationService implements INotificationService {
  channelName = 'in_app';

  async sendAlert(payload: NotificationPayload): Promise<NotificationResult> {
    const platformLabel =
      payload.platform === 'both'
        ? 'BookMyShow & District'
        : payload.platform === 'bookmyshow'
        ? 'BookMyShow'
        : 'District';

    const showSummary =
      payload.shows && payload.shows.length > 0
        ? ` (Shows: ${payload.shows.map((s) => s.showTime).join(', ')})`
        : '';

    const movieDisplay = payload.language ? `"${payload.movieTitle}" (${payload.language})` : `"${payload.movieTitle}"`;
    const message = `🎬 Tickets Released! Shows for ${movieDisplay} at ${payload.theatreName}, ${payload.city} on ${payload.watchDate} are now open for booking via ${platformLabel}${showSummary}. Alert sent to ${payload.phoneNumber}.`;

    try {
      const record = await DataRepository.recordNotification({
        alert_id: payload.alertId,
        user_id: payload.userId,
        channel: this.channelName,
        recipient: payload.phoneNumber,
        status: 'SENT',
        message,
        provider_response: {
          delivered: true,
          channel: 'in_app',
          showsCount: payload.shows?.length || 0,
        },
      });

      return {
        success: true,
        channel: this.channelName,
        messageId: record.id,
        rawResponse: { recordId: record.id },
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
