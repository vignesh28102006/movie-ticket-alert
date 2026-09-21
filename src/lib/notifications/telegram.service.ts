import { INotificationService, NotificationPayload, NotificationResult } from './notification.interface';
import { DataRepository } from '@/lib/db/repo';

/**
 * TelegramNotificationService
 *
 * FREE real-time notification via Telegram Bot API.
 *
 * Setup (one-time, free):
 * 1. Open Telegram and message @BotFather
 * 2. Send /newbot → follow prompts → get TELEGRAM_BOT_TOKEN
 * 3. Message your new bot → visit https://api.telegram.org/bot{TOKEN}/getUpdates
 *    to find your chat_id → set as TELEGRAM_CHAT_ID
 *
 * Env vars required (in .env.local):
 *   TELEGRAM_BOT_TOKEN=7123456789:AABBcc...
 *   TELEGRAM_CHAT_ID=123456789
 *
 * Features:
 * - Rich HTML-formatted message with show details and booking links
 * - Supports per-alert telegram_chat_id (future: per-user chat)
 * - Records notification in audit log
 * - Falls back to in-app notification on failure
 */
export class TelegramNotificationService implements INotificationService {
  channelName = 'telegram';

  async sendAlert(payload: NotificationPayload): Promise<NotificationResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    // Support per-alert override OR global default
    const chatId = payload.telegramChatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        success: false,
        channel: this.channelName,
        error:
          'Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local. ' +
          'See README → Telegram Setup for free setup instructions.',
      };
    }

    const platformLabel =
      payload.platform === 'both'
        ? 'BookMyShow &amp; District'
        : payload.platform === 'bookmyshow'
        ? 'BookMyShow'
        : 'District';

    // Build show lines with deep booking links where available
    const showLines =
      payload.shows && payload.shows.length > 0
        ? payload.shows
            .slice(0, 6) // Telegram message limit safeguard
            .map((s) =>
              s.bookingUrl
                ? `  • <a href="${s.bookingUrl}">${s.showTime}${s.screenName ? ` — ${s.screenName}` : ''}</a>`
                : `  • ${s.showTime}${s.screenName ? ` — ${s.screenName}` : ''}`
            )
            .join('\n')
        : '  • Click below to check availability';

    const text =
      `🚨 <b>TICKET DROP ALERT!</b> 🚨\n\n` +
      `🎬 <b>${payload.movieTitle}</b>\n` +
      `📅 Date: ${payload.watchDate}\n` +
      `📍 City: ${payload.city}\n` +
      `🏛️ Theatre: ${payload.theatreName}\n` +
      `🎟️ Platform: ${platformLabel}\n\n` +
      `<b>Available Shows:</b>\n${showLines}\n\n` +
      `⚡ <b>Book NOW before seats sell out!</b>`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      const data = (await response.json()) as { ok: boolean; result?: { message_id: number }; description?: string };

      // Record in audit log regardless of Telegram result
      await DataRepository.recordNotification({
        alert_id: payload.alertId,
        user_id: payload.userId,
        channel: this.channelName,
        recipient: chatId,
        status: data.ok ? 'SENT' : 'FAILED',
        message: text,
        provider_response: data as Record<string, unknown>,
      });

      if (!response.ok || !data.ok) {
        return {
          success: false,
          channel: this.channelName,
          error: data.description || `Telegram API returned ${response.status}`,
          rawResponse: data as Record<string, unknown>,
        };
      }

      return {
        success: true,
        channel: this.channelName,
        messageId: String(data.result?.message_id),
        rawResponse: data as Record<string, unknown>,
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
