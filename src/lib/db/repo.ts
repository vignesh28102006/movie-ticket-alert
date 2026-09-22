import { Alert, AlertStatus, CreateAlertInput, Movie, NotificationRecord, Theatre, TicketAvailabilityCheck, UpdateAlertInput } from '@/types/database';
import { INITIAL_MOVIES, INITIAL_THEATRES } from './seed-data';

// Persistent in-process / local store for development and testing
class LocalStore {
  movies: Movie[] = [...INITIAL_MOVIES];
  theatres: Theatre[] = [...INITIAL_THEATRES];
  alerts: Alert[] = [];
  checks: TicketAvailabilityCheck[] = [];
  notifications: NotificationRecord[] = [];

  constructor() {
    // Seed an initial demo alert if empty for quick verification
    const defaultUserId = 'default-user-id';
    this.alerts = [
      {
        id: 'demo-alert-1',
        user_id: defaultUserId,
        movie_id: 'm1-paradise',
        theatre_id: 't1-kg-cinemas-cbe',
        city: 'Coimbatore',
        watch_date: '2026-09-24',
        language: 'Telugu',
        platform: 'both',
        phone_number: '+919876543210',
        status: 'WAITING',
        alert_sent: false,
        check_count: 12,
        last_checked_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 86400 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'demo-alert-2',
        user_id: defaultUserId,
        movie_id: 'm2-coolie',
        theatre_id: 't5-pvr-sathyam-chn',
        city: 'Chennai',
        watch_date: '2026-10-02',
        language: 'Tamil',
        platform: 'bookmyshow',
        phone_number: '+919876543210',
        status: 'RELEASED',
        alert_sent: true,
        check_count: 45,
        last_checked_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];

    this.notifications = [
      {
        id: 'demo-notif-1',
        alert_id: 'demo-alert-2',
        user_id: defaultUserId,
        channel: 'in_app',
        recipient: '+919876543210',
        status: 'SENT',
        message: '🎬 Tickets Released! Shows for "Coolie" (Tamil) at PVR Sathyam Cinemas, Chennai on 2026-10-02 are now open for booking via BookMyShow.',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
    ];
  }
}

// Global singleton for Next.js hot-reload persistence
const globalStore = (globalThis as unknown as { __TICKET_STORE__?: LocalStore });
if (!globalStore.__TICKET_STORE__) {
  globalStore.__TICKET_STORE__ = new LocalStore();
}
export const store = globalStore.__TICKET_STORE__;

export class DataRepository {
  // Movie methods
  static async getMovies(): Promise<Movie[]> {
    return store.movies;
  }

  static async getMovieById(id: string): Promise<Movie | undefined> {
    return store.movies.find((m) => m.id === id || m.slug === id);
  }

  // Theatre methods
  static async getTheatres(city?: string): Promise<Theatre[]> {
    if (city) {
      return store.theatres.filter((t) => t.city.toLowerCase() === city.toLowerCase());
    }
    return store.theatres;
  }

  static async getTheatreById(id: string): Promise<Theatre | undefined> {
    return store.theatres.find((t) => t.id === id);
  }

  // Alert methods
  static async getAlerts(userId: string): Promise<Alert[]> {
    const userAlerts = store.alerts.filter((a) => a.user_id === userId);
    return userAlerts.map((alert) => ({
      ...alert,
      language: alert.language || store.movies.find((m) => m.id === alert.movie_id)?.language || 'Tamil',
      movie: store.movies.find((m) => m.id === alert.movie_id),
      theatre: store.theatres.find((t) => t.id === alert.theatre_id),
    }));
  }

  static async getAlertById(id: string, userId?: string): Promise<Alert | undefined> {
    const alert = store.alerts.find((a) => a.id === id && (!userId || a.user_id === userId));
    if (!alert) return undefined;
    return {
      ...alert,
      language: alert.language || store.movies.find((m) => m.id === alert.movie_id)?.language || 'Tamil',
      movie: store.movies.find((m) => m.id === alert.movie_id),
      theatre: store.theatres.find((t) => t.id === alert.theatre_id),
    };
  }

  static async createAlert(userId: string, input: CreateAlertInput): Promise<Alert> {
    const now = new Date().toISOString();
    const movie = store.movies.find((m) => m.id === input.movie_id);
    const newAlert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      movie_id: input.movie_id,
      theatre_id: input.theatre_id,
      city: input.city,
      watch_date: input.watch_date,
      language: input.language || movie?.language || 'Tamil',
      platform: input.platform,
      phone_number: input.phone_number,
      status: 'WAITING',
      alert_sent: false,
      check_count: 0,
      simulate_release: input.simulate_release ?? false,
      created_at: now,
      updated_at: now,
    };

    store.alerts.unshift(newAlert);
    return {
      ...newAlert,
      movie,
      theatre: store.theatres.find((t) => t.id === newAlert.theatre_id),
    };
  }

  static async updateAlert(id: string, userId: string, input: UpdateAlertInput): Promise<Alert | undefined> {
    const index = store.alerts.findIndex((a) => a.id === id && a.user_id === userId);
    if (index === -1) return undefined;

    const existing = store.alerts[index];
    const updated: Alert = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };

    store.alerts[index] = updated;
    return {
      ...updated,
      movie: store.movies.find((m) => m.id === updated.movie_id),
      theatre: store.theatres.find((t) => t.id === updated.theatre_id),
    };
  }

  static async deleteAlert(id: string, userId: string): Promise<boolean> {
    const index = store.alerts.findIndex((a) => a.id === id && a.user_id === userId);
    if (index === -1) return false;
    store.alerts.splice(index, 1);
    return true;
  }

  // Active alerts query for background monitoring worker
  static async getActiveAlerts(): Promise<Alert[]> {
    return store.alerts
      .filter((a) => ['WAITING', 'CHECKING', 'ERROR'].includes(a.status))
      .map((alert) => ({
        ...alert,
        language: alert.language || store.movies.find((m) => m.id === alert.movie_id)?.language || 'Tamil',
        movie: store.movies.find((m) => m.id === alert.movie_id),
        theatre: store.theatres.find((t) => t.id === alert.theatre_id),
      }));
  }

  // Record check results
  static async recordAvailabilityCheck(check: Omit<TicketAvailabilityCheck, 'id' | 'checked_at'>): Promise<TicketAvailabilityCheck> {
    const record: TicketAvailabilityCheck = {
      id: `check-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...check,
      checked_at: new Date().toISOString(),
    };
    store.checks.unshift(record);

    // Limit check logs in memory
    if (store.checks.length > 500) {
      store.checks = store.checks.slice(0, 500);
    }
    return record;
  }

  // Update alert status & check counters
  static async updateAlertStatus(
    id: string,
    status: AlertStatus,
    alertSent?: boolean,
    errorMessage?: string | null,
    incrementCheckCount: boolean = true
  ): Promise<Alert | undefined> {
    const alert = store.alerts.find((a) => a.id === id);
    if (!alert) return undefined;

    alert.status = status;
    alert.last_checked_at = new Date().toISOString();
    if (incrementCheckCount) {
      alert.check_count = (alert.check_count || 0) + 1;
    }
    if (alertSent !== undefined) {
      alert.alert_sent = alertSent;
    }
    if (errorMessage !== undefined) {
      alert.error_message = errorMessage;
    }
    alert.updated_at = new Date().toISOString();
    return alert;
  }

  // Notifications audit trail
  static async recordNotification(
    notif: Omit<NotificationRecord, 'id' | 'sent_at' | 'created_at'>
  ): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...notif,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    store.notifications.unshift(record);
    return record;
  }

  static async getNotifications(userId: string): Promise<NotificationRecord[]> {
    return store.notifications.filter((n) => n.user_id === userId);
  }
}
