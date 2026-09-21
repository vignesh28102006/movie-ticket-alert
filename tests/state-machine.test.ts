import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertStateMachine } from '../src/lib/monitoring/state-machine';

test('AlertStateMachine: allows valid transitions', () => {
  assert.equal(AlertStateMachine.canTransition('WAITING', 'CHECKING'), true);
  assert.equal(AlertStateMachine.canTransition('CHECKING', 'WAITING'), true);
  assert.equal(AlertStateMachine.canTransition('CHECKING', 'RELEASED'), true);
  assert.equal(AlertStateMachine.canTransition('RELEASED', 'NOTIFIED'), true);
  assert.equal(AlertStateMachine.canTransition('CHECKING', 'ERROR'), true);
  assert.equal(AlertStateMachine.canTransition('ERROR', 'CHECKING'), true);
  assert.equal(AlertStateMachine.canTransition('WAITING', 'CANCELLED'), true);
});

test('AlertStateMachine: rejects invalid transitions', () => {
  // Terminal states cannot transition backwards
  assert.equal(AlertStateMachine.canTransition('NOTIFIED', 'WAITING'), false);
  assert.equal(AlertStateMachine.canTransition('CANCELLED', 'CHECKING'), false);
  assert.equal(AlertStateMachine.canTransition('WAITING', 'NOTIFIED'), false); // Must go through RELEASED

  assert.throws(() => {
    AlertStateMachine.transition('NOTIFIED', 'WAITING');
  }, /Invalid state transition/);
});

test('AlertStateMachine: isMonitorable logic', () => {
  // Active alerts are monitorable
  assert.equal(AlertStateMachine.isMonitorable('WAITING', false), true);
  assert.equal(AlertStateMachine.isMonitorable('CHECKING', false), true);
  assert.equal(AlertStateMachine.isMonitorable('ERROR', false), true);

  // Completed / Notified alerts must NOT be monitored
  assert.equal(AlertStateMachine.isMonitorable('NOTIFIED', true), false);
  assert.equal(AlertStateMachine.isMonitorable('WAITING', true), false); // already notified
  assert.equal(AlertStateMachine.isMonitorable('CANCELLED', false), false);
});
