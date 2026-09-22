import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { DataRepository } from '../src/lib/db/repo';
import { MonitoringEngine } from '../src/lib/monitoring/monitor-engine';
import { ITicketProvider, ProviderCheckResult } from '../src/lib/providers';
import { InAppNotificationService } from '../src/lib/notifications/in-app.service';
import { POST as handleExternalCheck } from '../src/app/api/external-check/route';

const TEST_SECRET = 'super_secret_cron_key_for_ticket_checker_2026';

function createApiRequest(
  body: Record<string, unknown>,
  token: string | null = TEST_SECRET,
  userId?: string
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (userId) {
    headers['x-user-id'] = userId;
  }
  return new NextRequest('http://localhost:3000/api/external-check', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// Simulates the ExternalCheckProvider used in /api/external-check
class SyntheticProvider implements ITicketProvider {
  name = 'Synthetic Provider';
  constructor(private result: ProviderCheckResult) {}
  async checkAvailability(): Promise<ProviderCheckResult> {
    return this.result;
  }
}

// =========================================================================
// Integration tests for the POST /api/external-check API endpoint
// =========================================================================

test('API /api/external-check: Rejects unauthenticated requests with no token or user header', async () => {
  const req = createApiRequest({ alert_id: 'any', provider: 'bookmyshow', available: true }, null);
  const res = await handleExternalCheck(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('API /api/external-check: Rejects requests with wrong Bearer token', async () => {
  const req = createApiRequest({ alert_id: 'any', provider: 'bookmyshow', available: true }, 'wrong-secret');
  const res = await handleExternalCheck(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('Security — User-Scoped Auth: User A cannot report checks on User B alert without CRON_SECRET', async () => {
  const alertB = await DataRepository.createAlert('user-b', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  // User A attempts to report for User B's alert using user-scoped auth header
  const req = createApiRequest(
    {
      alert_id: alertB.id,
      provider: 'bookmyshow',
      available: true,
      observed_movie: 'Paradise',
      observed_theatre: 'KG Cinemas',
      observed_date: '2026-09-24',
      shows: [{ showTime: '10:30 AM' }],
    },
    null, // No server CRON_SECRET
    'user-a' // Logged in as User A
  );

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 403, 'Must return 403 Forbidden for mismatched user');
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Forbidden/);

  // Alert B must remain in WAITING
  const checkAlertB = await DataRepository.getAlertById(alertB.id);
  assert.equal(checkAlertB?.status, 'WAITING');
});

test('Security — User-Scoped Auth: User A can report checks for their own alert with zero server secrets', async () => {
  const alertA = await DataRepository.createAlert('user-a-legit', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest(
    {
      alert_id: alertA.id,
      provider: 'bookmyshow',
      available: true,
      check_status: 'CONFIRMED_AVAILABLE',
      observed_movie: 'Paradise',
      observed_theatre: 'KG Cinemas',
      observed_date: '2026-09-24',
      shows: [{ showTime: '10:30 AM', screenName: 'Screen 1' }],
    },
    null, // Zero server secrets in request!
    'user-a-legit' // Authenticated as the alert owner
  );

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, 'NOTIFIED');

  const finalAlert = await DataRepository.getAlertById(alertA.id);
  assert.equal(finalAlert?.status, 'NOTIFIED');
});

test('Case A — Correct alert: Browser-reported data triggers CONFIRMED_AVAILABLE -> RELEASED -> NOTIFIED', async () => {
  const alert = await DataRepository.createAlert('user-case-a', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Telugu',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    check_status: 'CONFIRMED_AVAILABLE',
    observed_movie: 'Paradise',
    observed_language: 'Telugu',
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
    shows: [
      {
        showTime: '10:30 AM',
        screenName: 'Screen 1',
        bookingUrl: 'https://in.bookmyshow.com/buytickets/paradise-telugu-coimbatore',
      },
    ],
    source_url: 'https://in.bookmyshow.com/buytickets/paradise-telugu-coimbatore',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, 'NOTIFIED');
  assert.equal(data.notificationSent, true);

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'NOTIFIED');
  assert.equal(updatedAlert?.alert_sent, true);
});

test('Case A-2 — Paradise Telugu matches Paradise Telugu', async () => {
  const alert = await DataRepository.createAlert('user-case-a2', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Telugu',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    check_status: 'CONFIRMED_AVAILABLE',
    observed_movie: 'Paradise',
    observed_language: 'Telugu',
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
    shows: [{ showTime: '02:30 PM', screenName: 'Screen 1' }],
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, 'NOTIFIED');
});

test('Case A-3 — Paradise Telugu does NOT match Paradise Tamil', async () => {
  const alert = await DataRepository.createAlert('user-case-a3', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Telugu',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  // Browser reports Paradise Tamil page
  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    check_status: 'CONFIRMED_AVAILABLE',
    observed_movie: 'Paradise',
    observed_language: 'Tamil', // Mismatched language!
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
    shows: [{ showTime: '10:30 AM' }],
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Language mismatch/);

  const checkAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(checkAlert?.status, 'WAITING', 'Alert must stay WAITING');
});

test('Case A-4 — Paradise Tamil does NOT match Paradise Telugu', async () => {
  const alert = await DataRepository.createAlert('user-case-a4', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Tamil',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  // Browser reports Paradise Telugu page
  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    check_status: 'CONFIRMED_AVAILABLE',
    observed_movie: 'Paradise',
    observed_language: 'Telugu', // Mismatched language!
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
    shows: [{ showTime: '10:30 AM' }],
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Language mismatch/);

  const checkAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(checkAlert?.status, 'WAITING', 'Alert must stay WAITING');
});

test('Case A-5 — Default alert without explicit language defaults to Tamil and rejects Telugu check', async () => {
  const alert = await DataRepository.createAlert('user-case-a5', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  assert.equal(alert.language, 'Tamil');

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    observed_movie: 'Paradise',
    observed_language: 'Telugu',
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Language mismatch/);
});

test('Case B — Wrong movie: Rejects release when reported movie mismatches alert', async () => {
  const alert = await DataRepository.createAlert('user-case-b', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    observed_movie: 'Avatar 3', // Wrong movie!
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Movie mismatch/);

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'WAITING', 'Alert must stay WAITING');
});

test('Case C — Wrong theatre: Rejects release when reported theatre mismatches alert', async () => {
  const alert = await DataRepository.createAlert('user-case-c', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    observed_movie: 'Paradise',
    observed_theatre: 'PVR Sathyam Chennai', // Wrong theatre!
    observed_date: '2026-09-24',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Theatre mismatch/);

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'WAITING', 'Alert must stay WAITING');
});

test('Case D — Wrong date: Rejects release when reported date mismatches alert', async () => {
  const alert = await DataRepository.createAlert('user-case-d', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    observed_movie: 'Paradise',
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-10-10', // Wrong date!
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Date mismatch/);

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'WAITING', 'Alert must stay WAITING');
});

test('Case E — Wrong platform: Rejects check when provider does not match alert platform', async () => {
  const alert = await DataRepository.createAlert('user-case-e', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow', // Alert configured ONLY for BMS
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'district', // Reporter is District
    available: true,
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Platform mismatch/);

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'WAITING', 'Alert must stay WAITING');
});

test('Case F & G — Duplicate check & spam prevention: Only one notification sent, repeat calls acknowledged safely', async () => {
  const alert = await DataRepository.createAlert('user-case-fg', {
    movie_id: 'm2-coolie',
    theatre_id: 't5-pvr-sathyam-chn',
    city: 'Chennai',
    watch_date: '2026-10-02',
    platform: 'both',
    phone_number: '+919876543210',
  });

  const req1 = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    shows: [{ showTime: '6:30 PM', screenName: 'Screen 2' }],
  });

  // First check triggers notification
  const res1 = await handleExternalCheck(req1);
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(data1.notificationSent, true);

  // Second check with same availability must NOT re-notify
  const req2 = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: true,
    shows: [{ showTime: '6:30 PM', screenName: 'Screen 2' }],
  });

  const res2 = await handleExternalCheck(req2);
  const data2 = await res2.json();
  assert.equal(data2.success, true);
  assert.equal(data2.notificationSent, false, 'Must not double-notify');
  assert.match(data2.message, /already notified/i);
});

test('Case H — BLOCKED: Leaves alert safely in WAITING without false release', async () => {
  const alert = await DataRepository.createAlert('user-case-h', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'bookmyshow',
    available: false,
    check_status: 'BLOCKED',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, 'WAITING');

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'WAITING');
});

test('Case I — TEMPORARY_ERROR: Transitions to ERROR state for dashboard retry visibility', async () => {
  const alert = await DataRepository.createAlert('user-case-i', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'district',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'district',
    available: false,
    check_status: 'TEMPORARY_ERROR',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, 'ERROR');

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'ERROR');
});

test('Case J — MOVIE_NOT_FOUND: Alert remains safely waiting', async () => {
  const alert = await DataRepository.createAlert('user-case-j', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'district',
    phone_number: '+919876543210',
  });

  const req = createApiRequest({
    alert_id: alert.id,
    provider: 'district',
    available: false,
    check_status: 'MOVIE_NOT_FOUND',
  });

  const res = await handleExternalCheck(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, 'WAITING');

  const updatedAlert = await DataRepository.getAlertById(alert.id);
  assert.equal(updatedAlert?.status, 'WAITING');
});

test('Section 9 — Multi-alert isolation: Event observed for Alert A cannot release Alert B', async () => {
  const alertA = await DataRepository.createAlert('user-multi-a', {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  const alertB = await DataRepository.createAlert('user-multi-b', {
    movie_id: 'm2-coolie',
    theatre_id: 't5-pvr-sathyam-chn',
    city: 'Chennai',
    watch_date: '2026-10-02',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });

  // Attempt to submit Alert A's observed page data against Alert B's ID
  const crossReq = createApiRequest({
    alert_id: alertB.id,
    provider: 'bookmyshow',
    available: true,
    observed_movie: 'Paradise', // Alert A's movie
    observed_theatre: 'KG Cinemas', // Alert A's theatre
    observed_date: '2026-09-24', // Alert A's date
    shows: [{ showTime: '10:00 AM' }],
  });

  const crossRes = await handleExternalCheck(crossReq);
  assert.equal(crossRes.status, 400);
  const crossData = await crossRes.json();
  assert.equal(crossData.success, false);
  assert.match(crossData.error, /Movie mismatch/);

  // Verify Alert B was NOT released
  const checkAlertB = await DataRepository.getAlertById(alertB.id);
  assert.equal(checkAlertB?.status, 'WAITING', 'Alert B must stay in WAITING');

  // Now submit correct data for Alert A
  const validReqA = createApiRequest({
    alert_id: alertA.id,
    provider: 'bookmyshow',
    available: true,
    observed_movie: 'Paradise',
    observed_theatre: 'KG Cinemas',
    observed_date: '2026-09-24',
    shows: [{ showTime: '10:00 AM', screenName: 'Screen 1' }],
  });

  const validResA = await handleExternalCheck(validReqA);
  assert.equal(validResA.status, 200);
  const validDataA = await validResA.json();
  assert.equal(validDataA.success, true);
  assert.equal(validDataA.newStatus, 'NOTIFIED');

  // Verify Alert A is NOTIFIED, while Alert B is STILL in WAITING
  const finalAlertA = await DataRepository.getAlertById(alertA.id);
  const finalAlertB = await DataRepository.getAlertById(alertB.id);
  assert.equal(finalAlertA?.status, 'NOTIFIED');
  assert.equal(finalAlertB?.status, 'WAITING');
});

