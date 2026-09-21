import { INotificationService, NotificationPayload, NotificationResult } from './notification.interface';
import { DataRepository } from '@/lib/db/repo';

/**
 * WebPushNotificationService
 *
 * FREE browser-native push notifications via the Web Push Protocol (RFC 8030).
 *
 * How it works:
 * - User visits the dashboard, browser asks for notification permission
 * - Browser registers a push subscription (endpoint + keys) with the app
 * - App stores the subscription in the DB
 * - When tickets are found, this service sends a push notification to the browser
 * - Browser displays the notification even when the tab is closed (via Service Worker)
 *
 * Cost: FREE
 * - VAPID keys: generated locally once (no registration needed)
 * - Push delivery: Via browser vendors (Chrome/Firefox push servers) — free
 * - Requires: HTTPS in production (localhost works in dev)
 *
 * Setup:
 * 1. Generate VAPID keys once: `npx web-push generate-vapid-keys`
 * 2. Add to .env.local:
 *    NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
 *    VAPID_PRIVATE_KEY=<private_key>
 *    VAPID_SUBJECT=mailto:yourmail@example.com
 * 3. User visits dashboard → browser requests permission → subscription is saved
 *
 * ponytail: Web Push currently sends to a stored global subscription (one per app).
 * Future: Store per-user subscription in DB table for multi-user push delivery.
 */
export class WebPushNotificationService implements INotificationService {
  channelName = 'web_push';

  async sendAlert(payload: NotificationPayload): Promise<NotificationResult> {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';

    if (!publicKey || !privateKey) {
      return {
        success: false,
        channel: this.channelName,
        error:
          'Web Push VAPID keys not configured. Run: npx web-push generate-vapid-keys ' +
          'and add NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to .env.local. See README.',
      };
    }

    // web-push is an optional peer dependency — require() at runtime avoids compile-time errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let webpush: any = null;
    try {
      // ponytail: runtime require avoids build-time type error for optional dep; upgrade: install web-push + @types/web-push
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      webpush = require('web-push');
    } catch {
      return {
        success: false,
        channel: this.channelName,
        error:
          'web-push package not installed. Run: npm install web-push. ' +
          'It is an optional dependency for Web Push notifications.',
      };
    }

    // Load subscription from store (stored by /api/push-subscribe endpoint)
    const pushSubscription = (globalThis as unknown as { __PUSH_SUBSCRIPTION__?: PushSubscriptionJSON }).__PUSH_SUBSCRIPTION__;

    if (!pushSubscription) {
      return {
        success: false,
        channel: this.channelName,
        error:
          'No push subscription registered. User must visit dashboard and allow browser notifications.',
      };
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const notificationPayload = JSON.stringify({
      title: '🎬 Ticket Drop Alert!',
      body: `"${payload.movieTitle}" at ${payload.theatreName} on ${payload.watchDate} — BOOK NOW!`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        alertId: payload.alertId,
        movieTitle: payload.movieTitle,
        bookingUrl: payload.shows?.[0]?.bookingUrl || '#',
      },
      requireInteraction: true,
    });

    try {
      await webpush.sendNotification(pushSubscription as Parameters<typeof webpush.sendNotification>[0], notificationPayload);

      await DataRepository.recordNotification({
        alert_id: payload.alertId,
        user_id: payload.userId,
        channel: this.channelName,
        recipient: 'browser_push',
        status: 'SENT',
        message: `Browser push: ${payload.movieTitle} ticket alert`,
        provider_response: { delivered: true },
      });

      return { success: true, channel: this.channelName };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, channel: this.channelName, error: `Web Push delivery failed: ${error}` };
    }
  }
}

// JSON representation of a push subscription
interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}
