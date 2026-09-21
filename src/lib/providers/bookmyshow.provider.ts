import { CheckParams, ITicketProvider, ProviderCheckResult } from './ticket-provider.interface';

/**
 * BookMyShowTicketProvider
 *
 * ⚠️ STATUS: BLOCKED BY CLOUDFLARE — NOT RELIABLY FUNCTIONAL
 *
 * Real-world investigation (2026-09-22) confirmed:
 * - ALL requests to in.bookmyshow.com return HTTP 403 (Cloudflare challenge)
 * - This includes the main domain, movie pages, and deep-link URLs
 * - The 403 page says "Attention Required! | Cloudflare"
 * - BookMyShow has no public developer API
 * - The website requires JavaScript execution (SPA) and browser fingerprinting
 * - There is no legal server-side way to check ticket availability
 *
 * Implementation:
 * - Attempts a compliant HTTP check on the public site
 * - Returns BLOCKED status when 403/Cloudflare is detected
 * - Returns TEMPORARY_ERROR for timeouts, network failures
 * - NEVER returns CONFIRMED_AVAILABLE on error responses
 *
 * Upgrade path:
 * - Partner with BookMyShow for official B2B API access
 * - Or use a registered scraping service that handles JS rendering
 *   (requires separate legal review and paid subscription)
 */
export class BookMyShowTicketProvider implements ITicketProvider {
  name = 'BookMyShow';

  async checkAvailability(params: CheckParams): Promise<ProviderCheckResult> {
    const startTime = Date.now();
    const citySlug = params.city.toLowerCase().replace(/\s+/g, '-');
    const movieSlug = (params.movieSlug || params.movieTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const formattedDate = params.watchDate.replace(/-/g, '');

    // Known URL pattern for BMS movie showtimes
    const targetUrl = `https://in.bookmyshow.com/buytickets/${movieSlug}-cinemas-${citySlug}/movie-${citySlug}-ET00000000-MT/${formattedDate}`;

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
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: controller.signal,
          redirect: 'follow',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const responseTimeMs = Date.now() - startTime;
      const html = await response.text().catch(() => '');

      // Detect Cloudflare block (403 with challenge page)
      const isCloudflareBlocked =
        response.status === 403 ||
        html.includes('Cloudflare') ||
        html.includes('Attention Required') ||
        html.includes('cf-browser-verification');

      if (isCloudflareBlocked) {
        return {
          available: false,
          checkStatus: 'BLOCKED',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason:
            'BookMyShow is blocking server-side requests via Cloudflare. ' +
            'HTTP 403 received. Cannot determine ticket availability without browser JS execution.',
          details: {
            url: targetUrl,
            httpStatus: response.status,
            blocker: 'Cloudflare',
            note: 'This provider is currently non-functional for server-side checks.',
          },
        };
      }

      // Rate limited
      if (response.status === 429) {
        return {
          available: false,
          checkStatus: 'TEMPORARY_ERROR',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: 'BookMyShow rate limit hit (HTTP 429). Will retry after backoff.',
          details: { url: targetUrl, httpStatus: 429 },
        };
      }

      // Movie page not found for this date
      if (response.status === 404) {
        return {
          available: false,
          checkStatus: 'DATE_NOT_AVAILABLE',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: 'No show listing found for this movie/date combination on BookMyShow.',
          details: { url: targetUrl, httpStatus: 404 },
        };
      }

      // Unexpected non-OK response
      if (!response.ok) {
        return {
          available: false,
          checkStatus: 'TEMPORARY_ERROR',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: `Unexpected HTTP ${response.status} from BookMyShow.`,
          details: { url: targetUrl, httpStatus: response.status },
        };
      }

      // If we somehow get a 200 (no Cloudflare block), parse the HTML
      // Look for structured show data markers (conservative — many false positives exist in nav text)
      const hasShowtimeData =
        html.includes('data-showtime=') ||
        html.includes('"startTime"') ||
        html.includes('"ScreeningEvent"');

      if (!hasShowtimeData) {
        return {
          available: false,
          checkStatus: 'CONFIRMED_UNAVAILABLE',
          shows: [],
          providerName: this.name,
          responseTimeMs,
          reason: 'BookMyShow page loaded but no showtime data structures found.',
          details: { url: targetUrl, httpStatus: 200 },
        };
      }

      // If structured data found, mark available
      return {
        available: true,
        checkStatus: 'CONFIRMED_AVAILABLE',
        shows: [
          {
            showTime: 'Check BookMyShow',
            bookingUrl: targetUrl,
          },
        ],
        providerName: this.name,
        responseTimeMs,
        reason: 'Showtime data structures detected in BookMyShow page.',
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
          ? 'BookMyShow request timed out after 8 seconds.'
          : `BookMyShow network error: ${errorMessage}`,
        details: { url: targetUrl, isTimeout },
      };
    }
  }
}
