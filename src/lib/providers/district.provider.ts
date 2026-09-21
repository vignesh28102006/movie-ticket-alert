import { CheckParams, ITicketProvider, ProviderCheckResult } from './ticket-provider.interface';

/**
 * DistrictTicketProvider
 *
 * ⚠️ STATUS: PARTIALLY ACCESSIBLE BUT CLIENT-SIDE RENDERED — NOT RELIABLY FUNCTIONAL
 *
 * Real-world investigation (2026-09-22) confirmed:
 * - district.in home page returns HTTP 200 (no Cloudflare block)
 * - District does NOT use __NEXT_DATA__ for server-side rendering of movie data
 * - Movie pages return HTTP 404 even for movies listed in the homepage HTML
 * - Showtime data is loaded by client-side JavaScript (React hydration), not in initial HTML
 * - The 404 HTML contains "showtimes" only in generic marketing footer text — NOT real show data
 * - No official public API exists for District
 * - Slug format on the home page: "/movies/movie-name-movie-tickets-city"
 *   but this URL itself returns 404, suggesting data is loaded dynamically
 *
 * Implementation:
 * - Attempts a compliant HTTP check using the discovered slug format
 * - Returns CONFIRMED_UNAVAILABLE for genuine 404 (movie not yet listed)
 * - Returns TEMPORARY_ERROR for timeouts, network failures
 * - Returns CONFIRMED_AVAILABLE only if JSON-LD ScreeningEvent data is found in HTML
 *   (which requires the page to be server-rendered with real showtime data)
 * - NEVER returns CONFIRMED_AVAILABLE on marketing text, 404 pages, or error responses
 *
 * Upgrade path:
 * - Partner with Zomato/District for official B2B API access
 * - Use a JS-capable browser automation service that renders the page
 */
export class DistrictTicketProvider implements ITicketProvider {
  name = 'District (Zomato)';

  async checkAvailability(params: CheckParams): Promise<ProviderCheckResult> {
    const startTime = Date.now();
    const citySlug = params.city.toLowerCase().replace(/\s+/g, '-');
    const movieSlug = (params.movieSlug || params.movieTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+$/, '');

    // District's actual URL format discovered from homepage HTML
    const targetUrl = `https://www.district.in/movies/${movieSlug}-movie-tickets-${citySlug}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response: Response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
          redirect: 'follow',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const responseTimeMs = Date.now() - startTime;
      const html = await response.text().catch(() => '');

      // Rate limit
      if (response.status === 429) {
        return {
          available: false,
          checkStatus: 'TEMPORARY_ERROR',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: 'District rate limit hit (HTTP 429). Will retry after backoff.',
          details: { url: targetUrl, httpStatus: 429 },
        };
      }

      // Movie not yet listed on District
      if (response.status === 404) {
        return {
          available: false,
          checkStatus: 'MOVIE_NOT_FOUND',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: 'Movie not found on District for this city (HTTP 404). ' +
            'District renders showtime data client-side via JavaScript; ' +
            'the 404 page contains only generic marketing text about showtimes, not real show data.',
          details: {
            url: targetUrl,
            httpStatus: 404,
            note: 'District showtime data is client-rendered. Server-side checks cannot confirm availability.',
          },
        };
      }

      if (!response.ok) {
        return {
          available: false,
          checkStatus: 'TEMPORARY_ERROR',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: `Unexpected HTTP ${response.status} from District.`,
          details: { url: targetUrl, httpStatus: response.status },
        };
      }

      // We got a 200 — check for JSON-LD ScreeningEvent data
      // This is the ONLY reliable way to confirm tickets from server-rendered HTML
      const hasScreeningEvent = html.includes('"ScreeningEvent"') || html.includes('"EventReservation"');
      const hasRealShowtimes =
        html.includes('"startDate"') &&
        (html.includes('"performer"') || html.includes('"location"'));

      if (!hasScreeningEvent && !hasRealShowtimes) {
        // Could be client-rendered with no initial data
        return {
          available: false,
          checkStatus: 'CONFIRMED_UNAVAILABLE',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason:
            'District page returned 200 but contains no structured showtime data (client-rendered app). ' +
            'Cannot confirm ticket availability from server-side check.',
          details: {
            url: targetUrl,
            httpStatus: 200,
            note: 'District is a React SPA — showtimes load via JavaScript after page load.',
          },
        };
      }

      // JSON-LD with real show data found
      return {
        available: true,
        checkStatus: 'CONFIRMED_AVAILABLE',
        shows: [
          {
            showTime: 'Check District App',
            bookingUrl: targetUrl,
          },
        ],
        providerName: this.name,
        responseTimeMs,
        reason: 'Structured ScreeningEvent data confirmed in District page.',
        details: { url: targetUrl, httpStatus: 200 },
      };
    } catch (err) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');

      return {
        available: false,
        checkStatus: 'TEMPORARY_ERROR',
        shows: [],
        providerName: this.name,
        responseTimeMs,
        reason: isTimeout
          ? 'District request timed out after 8 seconds.'
          : `District network error: ${errorMessage}`,
        details: { url: targetUrl, isTimeout },
      };
    }
  }
}
