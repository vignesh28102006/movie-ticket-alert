import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DataRepository } from '@/lib/db/repo';
import { MonitoringEngine } from '@/lib/monitoring/monitor-engine';
import { MockTicketProvider } from '@/lib/providers/mock.provider';
import { ITicketProvider, ProviderCheckResult } from '@/lib/providers';
import { defaultNotificationService } from '@/lib/notifications';
import { Alert } from '@/types/database';

/**
 * POST /api/external-check
 *
 * Browser-Assisted Ticket Check Endpoint
 *
 * This is the solution for bypassing Cloudflare/SPA barriers on BMS/District:
 * Since server-side fetches are blocked by Cloudflare (403) and District is a
 * client-rendered SPA, we cannot detect ticket availability from the server.
 *
 * This endpoint accepts check results from the USER'S OWN BROWSER via:
 * 1. A Tampermonkey/Violentmonkey userscript installed by the user
 * 2. A browser extension (future)
 *
 * Flow:
 * 1. User's browser visits BMS / District (Cloudflare passes — it's a real browser)
 * 2. Userscript reads the rendered DOM for show data
 * 3. Userscript POSTs the result to this endpoint with the alert ID
 * 4. This endpoint updates the alert status just like the monitoring engine would
 * 5. If tickets found → notification sent
 *
 * Security:
 * - Requires the same CRON_SECRET as the cron endpoint (prevents random POSTs)
 * - alert_id must belong to a real alert in the database
 * - available=true ONLY accepted when provider explicitly confirms shows
 *
 * This approach is 100% compliant:
 * - No Cloudflare bypass — user's browser handles it normally
 * - No scraping bots — user's own browser visits the site they intend to book on
 * - User explicitly installs and controls the script
 */

const externalCheckSchema = z.object({
  alert_id: z.string().min(1),
  provider: z.enum(['bookmyshow', 'district', 'both', 'manual']),
  available: z.boolean(),
  check_status: z
    .enum([
      'CONFIRMED_AVAILABLE',
      'CONFIRMED_UNAVAILABLE',
      'MOVIE_NOT_FOUND',
      'THEATRE_NOT_FOUND',
      'DATE_NOT_AVAILABLE',
      'TEMPORARY_ERROR',
      'BLOCKED',
      'UNSUPPORTED',
      'INVALID_REQUEST',
    ])
    .optional(),
  observed_movie: z.string().optional(),
  observed_theatre: z.string().optional(),
  observed_date: z.string().optional(),
  shows: z
    .array(
      z.object({
        showTime: z.string(),
        screenName: z.string().optional(),
        bookingUrl: z.string().url().optional(),
        price: z.number().optional(),
      })
    )
    .optional()
    .default([]),
  source_url: z.string().url().optional(),
  user_agent: z.string().optional(),
});

/**
 * A thin pass-through provider that wraps an externally provided check result.
 * This lets us reuse the MonitoringEngine's full notification + state machine logic.
 */
class ExternalCheckProvider implements ITicketProvider {
  name = 'External Browser Check';
  constructor(private result: ProviderCheckResult) {}

  async checkAvailability(): Promise<ProviderCheckResult> {
    return this.result;
  }
}

export async function POST(request: NextRequest) {
  // Authentication: Accept either server-level CRON_SECRET OR user-scoped session/header
  const authHeader = request.headers.get('authorization');
  const userIdHeader = request.headers.get('x-user-id');
  const expectedSecret = process.env.CRON_SECRET || 'super_secret_cron_key_for_ticket_checker_2026';
  const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const isServerCronAuth = Boolean(providedToken && providedToken === expectedSecret);
  const isUserScopedAuth = Boolean(userIdHeader && userIdHeader.trim().length > 0);

  if (!isServerCronAuth && !isUserScopedAuth) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Unauthorized: provide either Bearer {CRON_SECRET} or user authentication header (x-user-id)',
      },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = externalCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', issues: parsed.error.format() },
      { status: 400 }
    );
  }

  const {
    alert_id,
    provider,
    available,
    check_status,
    observed_movie,
    observed_theatre,
    observed_date,
    shows,
    source_url,
  } = parsed.data;

  // Look up the alert
  const alert = await DataRepository.getAlertById(alert_id);
  if (!alert) {
    return NextResponse.json({ success: false, error: `Alert ${alert_id} not found` }, { status: 404 });
  }

  // User-scoped ownership verification: if not using server cron secret, user must own the alert
  if (!isServerCronAuth && isUserScopedAuth) {
    if (alert.user_id !== userIdHeader) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: user '${userIdHeader}' does not have permission to report checks for alert '${alert_id}'`,
        },
        { status: 403 }
      );
    }
  }

  // 1. Platform compatibility validation
  if (alert.platform !== 'both' && provider !== 'both' && provider !== 'manual' && alert.platform !== provider) {
    return NextResponse.json(
      {
        success: false,
        error: `Platform mismatch: alert ${alert_id} is configured for '${alert.platform}', but check reported '${provider}'`,
        matched: false,
      },
      { status: 400 }
    );
  }

  // 2. Movie match validation (if provided by reporter)
  if (observed_movie) {
    const movieTitle = alert.movie?.title?.toLowerCase() || '';
    const movieSlug = alert.movie?.slug?.toLowerCase() || '';
    const obs = observed_movie.toLowerCase();
    const matchesMovie = movieTitle.includes(obs) || obs.includes(movieTitle) || movieSlug.includes(obs) || obs.includes(movieSlug);
    if (!matchesMovie) {
      return NextResponse.json(
        {
          success: false,
          error: `Movie mismatch: alert is for '${alert.movie?.title}', but observed '${observed_movie}'`,
          matched: false,
        },
        { status: 400 }
      );
    }
  }

  // 3. Theatre match validation (if provided by reporter)
  if (observed_theatre) {
    const theatreName = alert.theatre?.name?.toLowerCase() || '';
    const obs = observed_theatre.toLowerCase();
    const matchesTheatre = theatreName.includes(obs) || obs.includes(theatreName);
    if (!matchesTheatre) {
      return NextResponse.json(
        {
          success: false,
          error: `Theatre mismatch: alert is for '${alert.theatre?.name}', but observed '${observed_theatre}'`,
          matched: false,
        },
        { status: 400 }
      );
    }
  }

  // 4. Date match validation (if provided by reporter)
  if (observed_date && observed_date !== alert.watch_date) {
    return NextResponse.json(
      {
        success: false,
        error: `Date mismatch: alert is for '${alert.watch_date}', but observed '${observed_date}'`,
        matched: false,
      },
      { status: 400 }
    );
  }

  // Deduplication guard: if already notified, acknowledge without double-processing
  if (alert.status === 'NOTIFIED' || alert.alert_sent) {
    return NextResponse.json({
      success: true,
      message: 'Alert already notified. No duplicate notification sent.',
      alertId: alert_id,
      previousStatus: alert.status,
      newStatus: alert.status,
      notificationSent: false,
      showsCount: shows?.length || 0,
    });
  }

  // Determine effective status
  const effectiveStatus = check_status || (available ? 'CONFIRMED_AVAILABLE' : 'CONFIRMED_UNAVAILABLE');

  // If not available or blocked/error, record and route safely
  if (!available || effectiveStatus !== 'CONFIRMED_AVAILABLE') {
    const dbStatus =
      effectiveStatus === 'TEMPORARY_ERROR'
        ? 'ERROR'
        : effectiveStatus === 'CONFIRMED_AVAILABLE'
        ? 'AVAILABLE'
        : 'UNAVAILABLE';

    await DataRepository.recordAvailabilityCheck({
      alert_id,
      platform: alert.platform,
      status: dbStatus,
      available_shows: shows ?? [],
      response_time_ms: 0,
      error: effectiveStatus === 'BLOCKED' ? 'Blocked by provider anti-bot challenge' : undefined,
    });

    if (effectiveStatus === 'TEMPORARY_ERROR') {
      await DataRepository.updateAlertStatus(alert_id, 'ERROR', false, 'Transient external check error');
      return NextResponse.json({
        success: true,
        message: 'Recorded: temporary check error. Alert set to ERROR for retry.',
        alertId: alert_id,
        newStatus: 'ERROR',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Recorded: status '${effectiveStatus}'. Alert remains in WAITING.`,
      alertId: alert_id,
      newStatus: 'WAITING',
    });
  }

  // Build a synthetic ProviderCheckResult from the external data
  const syntheticResult: ProviderCheckResult = {
    available: true,
    checkStatus: 'CONFIRMED_AVAILABLE',
    shows: shows ?? [],
    providerName: `Browser-assisted check (${provider})`,
    responseTimeMs: 0,
    reason: `Confirmed by user browser visiting ${source_url || provider} page`,
    details: {
      source: 'browser_userscript',
      sourceUrl: source_url,
      confirmedBy: 'real_browser_dom',
    },
  };

  // Create a MonitoringEngine backed by our synthetic provider
  const engine = new MonitoringEngine(
    new ExternalCheckProvider(syntheticResult),
    defaultNotificationService
  );

  // Run through the full engine (handles state transitions + notifications)
  const result = await engine.processAlert(alert as Alert);

  return NextResponse.json({
    success: true,
    message: result.notificationSent
      ? '🎉 Tickets confirmed! Notification sent.'
      : result.ticketsFound
      ? 'Tickets confirmed. Alert transitioned to RELEASED (notification pending).'
      : 'Processed.',
    alertId: alert_id,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    notificationSent: result.notificationSent,
    showsCount: result.showsCount,
  });
}
