import test from 'node:test';
import assert from 'node:assert/strict';
import { DataRepository } from '../src/lib/db/repo';

test('Alert CRUD: lifecycle and user isolation', async () => {
  const user1 = 'user-alice-101';
  const user2 = 'user-bob-202';

  // 1. Create alert for Alice with explicit language (Telugu)
  const createdAlice = await DataRepository.createAlert(user1, {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    language: 'Telugu',
    platform: 'both',
    phone_number: '+919876543210',
  });

  assert.ok(createdAlice.id);
  assert.equal(createdAlice.user_id, user1);
  assert.equal(createdAlice.status, 'WAITING');
  assert.equal(createdAlice.movie?.title, 'Paradise');
  assert.equal(createdAlice.language, 'Telugu');

  // 1b. Create alert without explicit language -> defaults to movie language or 'Tamil'
  const createdDefault = await DataRepository.createAlert(user1, {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'bookmyshow',
    phone_number: '+919876543210',
  });
  assert.equal(createdDefault.language, 'Tamil', 'Default language must be preserved');

  // 2. User Isolation: Bob cannot see Alice's alerts
  const bobAlerts = await DataRepository.getAlerts(user2);
  const aliceAlerts = await DataRepository.getAlerts(user1);

  assert.equal(bobAlerts.some((a) => a.id === createdAlice.id), false);
  assert.equal(aliceAlerts.some((a) => a.id === createdAlice.id), true);

  // 3. User Isolation: Bob cannot edit or delete Alice's alert
  const unauthorizedUpdate = await DataRepository.updateAlert(createdAlice.id, user2, {
    city: 'Chennai',
  });
  assert.equal(unauthorizedUpdate, undefined);

  const unauthorizedDelete = await DataRepository.deleteAlert(createdAlice.id, user2);
  assert.equal(unauthorizedDelete, false);

  // 4. Authorized Edit by Alice (including language update)
  const updatedAlice = await DataRepository.updateAlert(createdAlice.id, user1, {
    phone_number: '+919999888877',
    language: 'Tamil',
  });
  assert.equal(updatedAlice?.phone_number, '+919999888877');
  assert.equal(updatedAlice?.language, 'Tamil');

  // 5. Authorized Delete by Alice
  const deleted = await DataRepository.deleteAlert(createdAlice.id, user1);
  assert.equal(deleted, true);
  await DataRepository.deleteAlert(createdDefault.id, user1);

  const aliceAlertsAfter = await DataRepository.getAlerts(user1);
  assert.equal(aliceAlertsAfter.some((a) => a.id === createdAlice.id), false);
});
