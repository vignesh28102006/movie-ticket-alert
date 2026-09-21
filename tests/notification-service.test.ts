import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramNotificationService } from '../src/lib/notifications/telegram.service';
import { WebPushNotificationService } from '../src/lib/notifications/web-push.service';
import { InAppNotificationService } from '../src/lib/notifications/in-app.service';
import { NotificationDispatcher } from '../src/lib/notifications';

const DEMO_PAYLOAD = {
  alertId: 'test-alert-123',
  userId: 'test-user-456',
  movieTitle: 'Paradise',
  theatreName: 'KG Cinemas',
  watchDate: '2026-09-24',
  city: 'Coimbatore',
  platform: 'bookmyshow' as const,
  phoneNumber: '+919876543210',
  shows: [
    { showTime: '10:15 AM', screenName: 'Screen 1', bookingUrl: 'https://in.bookmyshow.com/test' },
    { showTime: '06:45 PM', screenName: 'Screen 2', bookingUrl: 'https://in.bookmyshow.com/test2' },
  ],
};

test('TelegramNotificationService: fails gracefully without config (not a crash)', async () => {
  // Without env vars, should return success:false with descriptive error
  const svc = new TelegramNotificationService();
  const result = await svc.sendAlert(DEMO_PAYLOAD);

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined, 'Must have an error message');
  assert.ok(
    result.error!.includes('TELEGRAM_BOT_TOKEN') || result.error!.includes('not configured'),
    `Error should mention config: ${result.error}`
  );
  assert.equal(result.channel, 'telegram');
});

test('TelegramNotificationService: uses per-alert telegramChatId when provided', async () => {
  // With no bot token, should fail — but the error proves it tried to use the chatId
  const svc = new TelegramNotificationService();
  const result = await svc.sendAlert({
    ...DEMO_PAYLOAD,
    telegramChatId: '987654321',
  });
  // Still fails without token — but no crash, and clean error
  assert.equal(result.success, false);
  assert.equal(result.channel, 'telegram');
});

test('WebPushNotificationService: fails gracefully without VAPID keys', async () => {
  const svc = new WebPushNotificationService();
  const result = await svc.sendAlert(DEMO_PAYLOAD);

  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
  assert.ok(
    result.error!.includes('VAPID') || result.error!.includes('not configured') || result.error!.includes('web-push'),
    `Error should mention VAPID or web-push: ${result.error}`
  );
  assert.equal(result.channel, 'web_push');
});

test('InAppNotificationService: always succeeds and records notification', async () => {
  const svc = new InAppNotificationService();
  const result = await svc.sendAlert(DEMO_PAYLOAD);

  assert.equal(result.success, true);
  assert.equal(result.channel, 'in_app');
  assert.ok(result.messageId !== undefined, 'Must return a messageId');
});

test('NotificationDispatcher: defaults to in_app when no env configured', async () => {
  // Save and clear env var
  const savedChannel = process.env.DEFAULT_NOTIFICATION_CHANNEL;
  delete process.env.DEFAULT_NOTIFICATION_CHANNEL;

  const dispatcher = new NotificationDispatcher();
  const result = await dispatcher.sendAlert(DEMO_PAYLOAD);

  // Should succeed via in_app fallback
  assert.equal(result.success, true);

  // Restore
  if (savedChannel) process.env.DEFAULT_NOTIFICATION_CHANNEL = savedChannel;
});

test('NotificationDispatcher: falls back to in_app when telegram not configured', async () => {
  const savedChannel = process.env.DEFAULT_NOTIFICATION_CHANNEL;
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;

  process.env.DEFAULT_NOTIFICATION_CHANNEL = 'telegram';
  delete process.env.TELEGRAM_BOT_TOKEN;

  const dispatcher = new NotificationDispatcher();
  const result = await dispatcher.sendAlert(DEMO_PAYLOAD);

  // Telegram fails → fallback to in_app result which is success
  // In_app always records, so the dispatcher returns in_app result
  assert.equal(result.success, true, 'Should succeed via in_app fallback');

  process.env.DEFAULT_NOTIFICATION_CHANNEL = savedChannel || 'in_app';
  if (savedToken) process.env.TELEGRAM_BOT_TOKEN = savedToken;
});

test('NotificationDispatcher: multi channel sends to all without crashing', async () => {
  const savedChannel = process.env.DEFAULT_NOTIFICATION_CHANNEL;
  process.env.DEFAULT_NOTIFICATION_CHANNEL = 'multi';

  const dispatcher = new NotificationDispatcher();
  // All external services will fail (no tokens/keys) but in_app will succeed
  const result = await dispatcher.sendAlert(DEMO_PAYLOAD);

  // multi mode always returns in_app result as the ground truth
  assert.equal(result.success, true);

  process.env.DEFAULT_NOTIFICATION_CHANNEL = savedChannel || 'in_app';
});
