import test from 'node:test';
import assert from 'node:assert/strict';
import { DataRepository } from '../src/lib/db/repo';

test('Alert CRUD: lifecycle and user isolation', async () => {
  const user1 = 'user-alice-101';
  const user2 = 'user-bob-202';

  // 1. Create alert for Alice
  const createdAlice = await DataRepository.createAlert(user1, {
    movie_id: 'm1-paradise',
    theatre_id: 't1-kg-cinemas-cbe',
    city: 'Coimbatore',
    watch_date: '2026-09-24',
    platform: 'both',
    phone_number: '+919876543210',
  });

  assert.ok(createdAlice.id);
  assert.equal(createdAlice.user_id, user1);
  assert.equal(createdAlice.status, 'WAITING');
  assert.equal(createdAlice.movie?.title, 'Paradise');

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

  // 4. Authorized Edit by Alice
  const updatedAlice = await DataRepository.updateAlert(createdAlice.id, user1, {
    phone_number: '+919999888877',
  });
  assert.equal(updatedAlice?.phone_number, '+919999888877');

  // 5. Authorized Delete by Alice
  const deleted = await DataRepository.deleteAlert(createdAlice.id, user1);
  assert.equal(deleted, true);

  const aliceAlertsAfter = await DataRepository.getAlerts(user1);
  assert.equal(aliceAlertsAfter.some((a) => a.id === createdAlice.id), false);
});
