import { DataRepository } from '@/lib/db/repo';
import { defaultNotificationService, INotificationService } from '@/lib/notifications';
import { defaultTicketProvider, ITicketProvider } from '@/lib/providers';
import { Alert } from '@/types/database';
import { AlertStateMachine } from './state-machine';

export interface ProcessAlertResult {
  alertId: string;
  previousStatus: string;
  newStatus: string;
  ticketsFound: boolean;
  notificationSent: boolean;
  error?: string;
  showsCount: number;
  /** Provider's precise check status for audit trail */
  checkStatus?: string;
}

export class MonitoringEngine {
  constructor(
    private ticketProvider: ITicketProvider = defaultTicketProvider,
    private notificationService: INotificationService = defaultNotificationService
  ) {}

  /**
   * Process a single alert check cycle.
   * CRITICAL: ONLY transitions to RELEASED when checkStatus === 'CONFIRMED_AVAILABLE'.
   * BLOCKED and TEMPORARY_ERROR results must NOT release — they go back to WAITING for retry.
   */
  async processAlert(alert: Alert): Promise<ProcessAlertResult> {
    const previousStatus = alert.status;

    // 1. Guard: only process monitorable alerts
    if (!AlertStateMachine.isMonitorable(alert.status, alert.alert_sent)) {
      return {
        alertId: alert.id,
        previousStatus,
        newStatus: alert.status,
        ticketsFound: false,
        notificationSent: false,
        showsCount: 0,
      };
    }

    // 2. Transition to CHECKING (no check_count increment — only counts completed checks)
    await DataRepository.updateAlertStatus(alert.id, 'CHECKING', undefined, null, false);

    const movie = alert.movie || (await DataRepository.getMovieById(alert.movie_id));
    const theatre = alert.theatre || (await DataRepository.getTheatreById(alert.theatre_id));

    const movieTitle = movie ? movie.title : 'Movie';
    const movieSlug = movie?.slug;
    const theatreName = theatre ? theatre.name : 'Theatre';
    const language = alert.language || movie?.language || 'Tamil';

    try {
      // 3. Query Ticket Provider
      const checkResult = await this.ticketProvider.checkAvailability({
        movieTitle,
        movieSlug,
        language,
        theatreName,
        theatreChain: theatre?.chain,
        city: alert.city,
        watchDate: alert.watch_date,
        platform: alert.platform,
        simulateRelease: alert.simulate_release,
      });

      // 4. Record the check result in DB for audit trail
      await DataRepository.recordAvailabilityCheck({
        alert_id: alert.id,
        platform: alert.platform,
        status: checkResult.available ? 'AVAILABLE' : checkResult.checkStatus === 'TEMPORARY_ERROR' ? 'ERROR' : 'UNAVAILABLE',
        available_shows: checkResult.shows,
        response_time_ms: checkResult.responseTimeMs,
        error: checkResult.reason,
      });

      // 5. Only CONFIRMED_AVAILABLE triggers a release transition
      //    BLOCKED, TEMPORARY_ERROR, MOVIE_NOT_FOUND etc. → back to WAITING for retry
      if (checkResult.checkStatus === 'CONFIRMED_AVAILABLE' && checkResult.available) {
        // Transition to RELEASED
        await DataRepository.updateAlertStatus(alert.id, 'RELEASED', undefined, null, false);

        let notificationSent = false;

        // Duplicate guard: Only send notification once
        if (!alert.alert_sent) {
          const notifResult = await this.notificationService.sendAlert({
            alertId: alert.id,
            userId: alert.user_id,
            movieTitle,
            language: checkResult.language || language,
            theatreName,
            watchDate: alert.watch_date,
            city: alert.city,
            platform: alert.platform,
            phoneNumber: alert.phone_number,
            shows: checkResult.shows,
          });

          if (notifResult.success) {
            notificationSent = true;
            await DataRepository.updateAlertStatus(alert.id, 'NOTIFIED', true, null, true);
          } else {
            // Stay at RELEASED; notification can be retried by the user or next cycle
            await DataRepository.updateAlertStatus(alert.id, 'RELEASED', false, notifResult.error, true);
          }
        }

        return {
          alertId: alert.id,
          previousStatus,
          newStatus: notificationSent ? 'NOTIFIED' : 'RELEASED',
          ticketsFound: true,
          notificationSent,
          showsCount: checkResult.shows.length,
          checkStatus: checkResult.checkStatus,
        };
      }

      // 6. Provider is BLOCKED (Cloudflare / 403) — don't mark as ERROR, just retry next cycle
      if (checkResult.checkStatus === 'BLOCKED') {
        await DataRepository.updateAlertStatus(alert.id, 'WAITING', false, null, true);
        return {
          alertId: alert.id,
          previousStatus,
          newStatus: 'WAITING',
          ticketsFound: false,
          notificationSent: false,
          error: checkResult.reason,
          showsCount: 0,
          checkStatus: 'BLOCKED',
        };
      }

      // 7. Transient error (timeout, 5xx, network) — mark ERROR so it's visible in dashboard
      if (checkResult.checkStatus === 'TEMPORARY_ERROR') {
        await DataRepository.updateAlertStatus(alert.id, 'ERROR', false, checkResult.reason, true);
        return {
          alertId: alert.id,
          previousStatus,
          newStatus: 'ERROR',
          ticketsFound: false,
          notificationSent: false,
          error: checkResult.reason,
          showsCount: 0,
          checkStatus: 'TEMPORARY_ERROR',
        };
      }

      // 8. All other statuses: not yet available — back to WAITING
      await DataRepository.updateAlertStatus(alert.id, 'WAITING', false, null, true);
      return {
        alertId: alert.id,
        previousStatus,
        newStatus: 'WAITING',
        ticketsFound: false,
        notificationSent: false,
        showsCount: 0,
        checkStatus: checkResult.checkStatus,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await DataRepository.updateAlertStatus(alert.id, 'ERROR', false, errorMsg);

      return {
        alertId: alert.id,
        previousStatus,
        newStatus: 'ERROR',
        ticketsFound: false,
        notificationSent: false,
        error: errorMsg,
        showsCount: 0,
        checkStatus: 'TEMPORARY_ERROR',
      };
    }
  }

  /**
   * Process all currently active alerts.
   */
  async processAllActiveAlerts(): Promise<ProcessAlertResult[]> {
    const activeAlerts = await DataRepository.getActiveAlerts();
    const results: ProcessAlertResult[] = [];

    for (const alert of activeAlerts) {
      const res = await this.processAlert(alert);
      results.push(res);
      // Polite 200ms pause between external provider checks
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }
}
