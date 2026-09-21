export type AlertStatus = 'WAITING' | 'CHECKING' | 'RELEASED' | 'NOTIFIED' | 'CANCELLED' | 'ERROR';
export type PlatformType = 'bookmyshow' | 'district' | 'both';
export type NotificationChannel = 'in_app' | 'telegram' | 'webhook' | 'phone_call' | 'multi';

export interface Movie {
  id: string;
  title: string;
  slug: string;
  poster_url?: string | null;
  language: string;
  release_date: string;
  is_active: boolean;
  created_at?: string;
}

export interface Theatre {
  id: string;
  name: string;
  city: string;
  address?: string | null;
  chain?: string | null;
  supported_platforms: PlatformType[];
  created_at?: string;
}

export interface Alert {
  id: string;
  user_id: string;
  movie_id: string;
  theatre_id: string;
  city: string;
  watch_date: string;
  platform: PlatformType;
  phone_number: string;
  status: AlertStatus;
  alert_sent: boolean;
  last_checked_at?: string | null;
  check_count: number;
  error_message?: string | null;
  simulate_release?: boolean;
  created_at: string;
  updated_at: string;

  // Joined relations for UI
  movie?: Movie;
  theatre?: Theatre;
}

export interface TicketAvailabilityCheck {
  id: string;
  alert_id: string;
  platform: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';
  available_shows?: Array<{
    show_time?: string;
    showTime?: string;
    screen_name?: string;
    screenName?: string;
    booking_url?: string;
    bookingUrl?: string;
    price?: number;
    category?: string;
  }>;
  response_time_ms?: number;
  error?: string | null;
  checked_at: string;
}

export interface NotificationRecord {
  id: string;
  alert_id: string;
  user_id: string;
  channel: NotificationChannel | string;
  recipient: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  message: string;
  provider_response?: Record<string, unknown> | null;
  sent_at: string;
  created_at: string;
}

export interface CreateAlertInput {
  movie_id: string;
  theatre_id: string;
  city: string;
  watch_date: string;
  platform: PlatformType;
  phone_number: string;
  simulate_release?: boolean;
}

export interface UpdateAlertInput {
  theatre_id?: string;
  city?: string;
  watch_date?: string;
  platform?: PlatformType;
  phone_number?: string;
  status?: AlertStatus;
}
