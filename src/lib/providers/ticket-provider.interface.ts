import { PlatformType } from '@/types/database';

/**
 * Precise status for each provider check result.
 * This is the single source of truth used by the monitoring engine
 * to determine whether to transition an alert to RELEASED.
 *
 * CRITICAL RULE: Only CONFIRMED_AVAILABLE may trigger a RELEASED transition.
 * Any other status must leave the alert in WAITING or ERROR state.
 */
export type ProviderCheckStatus =
  | 'CONFIRMED_AVAILABLE'   // Provider positively confirmed tickets are open for booking
  | 'CONFIRMED_UNAVAILABLE' // Provider confirmed the movie/show exists but tickets not yet released
  | 'MOVIE_NOT_FOUND'       // Provider cannot find this movie at all
  | 'THEATRE_NOT_FOUND'     // Movie found but not at this theatre
  | 'DATE_NOT_AVAILABLE'    // Movie+theatre found but not for this date
  | 'TEMPORARY_ERROR'       // Transient failure (timeout, 503, 429, network) - must NOT release
  | 'BLOCKED'               // Provider is returning 403/CAPTCHA - cannot determine status
  | 'UNSUPPORTED'           // This provider cannot check this combination
  | 'INVALID_REQUEST';      // Bad input - should not retry without fixing

export interface CheckParams {
  movieTitle: string;
  movieSlug?: string;
  language?: string;
  theatreName: string;
  theatreChain?: string | null;
  city: string;
  watchDate: string; // YYYY-MM-DD
  platform: PlatformType;
  simulateRelease?: boolean;
  forceError?: boolean;
}

export interface ShowInfo {
  showTime: string;
  screenName?: string;
  bookingUrl?: string;
  category?: string;
  price?: number;
}

export interface ProviderCheckResult {
  /**
   * ONLY true when status === 'CONFIRMED_AVAILABLE'.
   * The monitoring engine reads this to determine release state.
   * A provider must NEVER set this true on errors, timeouts, or ambiguous responses.
   */
  available: boolean;

  /**
   * Precise status of this check result.
   */
  checkStatus: ProviderCheckStatus;

  shows: ShowInfo[];
  providerName: string;
  responseTimeMs: number;

  /**
   * Normalized movie language if confirmed by provider.
   */
  language?: string;

  /**
   * Human-readable reason for the status (especially for errors).
   */
  reason?: string;

  details?: Record<string, unknown>;
}

export interface ITicketProvider {
  name: string;
  checkAvailability(params: CheckParams): Promise<ProviderCheckResult>;
}
