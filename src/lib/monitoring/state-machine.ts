import { AlertStatus } from '@/types/database';

export const VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  WAITING: ['CHECKING', 'CANCELLED'],
  CHECKING: ['WAITING', 'RELEASED', 'ERROR', 'CANCELLED'],
  RELEASED: ['NOTIFIED', 'CANCELLED'],
  NOTIFIED: [], // Terminal success state
  CANCELLED: [], // Terminal cancelled state
  ERROR: ['CHECKING', 'WAITING', 'CANCELLED'],
};

export class AlertStateMachine {
  /**
   * Validate if transition from currentStatus to nextStatus is permissible.
   */
  static canTransition(currentStatus: AlertStatus, nextStatus: AlertStatus): boolean {
    if (currentStatus === nextStatus) return true;
    const allowed = VALID_TRANSITIONS[currentStatus];
    return Boolean(allowed && allowed.includes(nextStatus));
  }

  /**
   * Enforce valid transition or throw an informative error.
   */
  static transition(currentStatus: AlertStatus, nextStatus: AlertStatus): AlertStatus {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new Error(`Invalid state transition: Cannot change status from ${currentStatus} to ${nextStatus}.`);
    }
    return nextStatus;
  }

  /**
   * Checks if an alert is eligible for monitoring.
   */
  static isMonitorable(status: AlertStatus, alertSent: boolean): boolean {
    if (alertSent) return false;
    return status === 'WAITING' || status === 'CHECKING' || status === 'ERROR';
  }
}
