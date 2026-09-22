import test from 'node:test';
import assert from 'node:assert/strict';
import { DataRepository } from '../src/lib/db/repo';
import { MonitoringEngine } from '../src/lib/monitoring/monitor-engine';
import { MockTicketProvider } from '../src/lib/providers/mock.provider';
import { InAppNotificationService } from '../src/lib/notifications/in-app.service';

test('End-to-End Flow: Create Alert -> Waiting -> Ticket Drop -> Notified -> Deduplication Guard', async () => {
  const userId = 'e2e-test-user-999';
  const mockProvider = new MockTicketProvider();
  const notifService = new InAppNotificationService();
  const engine = new MonitoringEngine(mockProvider, notifService);

  // Step 1: Create an alert (e.g. Paradise Telugu in Coimbatore on 24 Sep 2026 for BookMyShow + District)
  const alert = await DataRepository.createAlert(userId, {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Telugu',
    platform: 'both',
    phone_number: '+919876543210',
    simulate_release: false,
  });

  assert.equal(alert.status, 'WAITING');
  assert.equal(alert.language, 'Telugu');
  assert.equal(alert.alert_sent, false);
  assert.equal(alert.check_count, 0);

  // Step 2: Run worker check when tickets are unavailable
  const res1 = await engine.processAlert(alert);
  assert.equal(res1.ticketsFound, false);
  assert.equal(res1.newStatus, 'WAITING');
  assert.equal(res1.notificationSent, false);

  const checkedAlert1 = await DataRepository.getAlertById(alert.id);
  assert.equal(checkedAlert1?.status, 'WAITING');
  assert.equal(checkedAlert1?.check_count, 1);
  assert.equal(checkedAlert1?.alert_sent, false);

  // Step 3: Tickets drop! (simulate_release = true)
  checkedAlert1!.simulate_release = true;
  const res2 = await engine.processAlert(checkedAlert1!);

  assert.equal(res2.ticketsFound, true);
  assert.equal(res2.notificationSent, true);
  assert.equal(res2.newStatus, 'NOTIFIED');

  const notifiedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(notifiedAlert?.status, 'NOTIFIED');
  assert.equal(notifiedAlert?.alert_sent, true);

  // Step 4: Verify Notification was recorded with language
  const notifHistory = await DataRepository.getNotifications(userId);
  const relevantNotif = notifHistory.find((n) => n.alert_id === alert.id);
  assert.ok(relevantNotif, 'Notification must be stored in database history');
  assert.ok(relevantNotif?.message.includes('Paradise'));
  assert.ok(relevantNotif?.message.includes('Telugu'));

  // Step 5: Run worker cycle again -> Verify Deduplication Guard (No double notification)
  const notifsBefore = notifHistory.length;
  const res3 = await engine.processAlert(notifiedAlert!);

  // Alert is already notified and alert_sent=true, so it must not be monitored again
  assert.equal(res3.notificationSent, false);

  const notifsAfter = (await DataRepository.getNotifications(userId)).length;
  assert.equal(notifsAfter, notifsBefore, 'Duplicate notifications must be strictly prevented');
});
