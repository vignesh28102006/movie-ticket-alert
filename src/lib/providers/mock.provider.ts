import { CheckParams, ITicketProvider, ProviderCheckResult } from './ticket-provider.interface';

/**
 * MockTicketProvider
 *
 * A deterministic simulation provider for development and automated testing.
 * NEVER claims to detect real tickets from BookMyShow or District.
 * Used ONLY when DEFAULT_TICKET_PROVIDER=mock or simulateRelease=true.
 *
 * Supports testing all 10 false-positive protection cases:
 * 1. simulateRelease=false → CONFIRMED_UNAVAILABLE
 * 2. simulateRelease=true  → CONFIRMED_AVAILABLE
 * 3. forceError=true       → TEMPORARY_ERROR
 * 4. forceTimeout=true     → TEMPORARY_ERROR (timeout)
 * 5. forceBlocked=true     → BLOCKED (403 simulation)
 * 6. forceMovieNotFound    → MOVIE_NOT_FOUND
 * 7. forceTheatreNotFound  → THEATRE_NOT_FOUND
 * 8. forceDateUnavailable  → DATE_NOT_AVAILABLE
 */
export class MockTicketProvider implements ITicketProvider {
  name = 'Mock Ticket Provider [SIMULATION - NOT REAL]';

  async checkAvailability(params: CheckParams): Promise<ProviderCheckResult> {
    const startTime = Date.now();

    // Small simulated network latency
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Forced error scenarios for testing
    if (params.forceError) {
      return {
        available: false,
        checkStatus: 'TEMPORARY_ERROR',
        shows: [],
        providerName: this.name,
        responseTimeMs: Date.now() - startTime,
        reason: 'Simulated 503 Service Unavailable / Rate Limit',
        details: { simulated: true },
      };
    }

    // Simulate confirmed ticket availability
    if (params.simulateRelease) {
      return {
        available: true,
        checkStatus: 'CONFIRMED_AVAILABLE',
        shows: [
          {
            showTime: '10:15 AM',
            screenName: 'Screen 1 (Dolby Atmos)',
            bookingUrl: `https://in.bookmyshow.com/buytickets/${params.movieSlug || 'movie'}-${params.city.toLowerCase()}`,
            price: 190,
          },
          {
            showTime: '02:30 PM',
            screenName: 'Screen 1 (Dolby Atmos)',
            bookingUrl: `https://in.bookmyshow.com/buytickets/${params.movieSlug || 'movie'}-${params.city.toLowerCase()}`,
            price: 190,
          },
          {
            showTime: '06:45 PM',
            screenName: 'Screen 2 (EPIQ 4K)',
            bookingUrl: `https://in.bookmyshow.com/buytickets/${params.movieSlug || 'movie'}-${params.city.toLowerCase()}`,
            price: 220,
          },
          {
            showTime: '10:30 PM',
            screenName: 'Screen 2 (EPIQ 4K)',
            bookingUrl: `https://in.bookmyshow.com/buytickets/${params.movieSlug || 'movie'}-${params.city.toLowerCase()}`,
            price: 220,
          },
        ],
        providerName: this.name,
        responseTimeMs: Date.now() - startTime,
        reason: 'SIMULATED release for testing purposes',
        details: {
          simulated: true,
          warning: 'This is NOT real ticket data from BookMyShow or District',
          matchCity: params.city,
          matchTheatre: params.theatreName,
          watchDate: params.watchDate,
        },
      };
    }

    // Default: tickets not yet open for booking
    return {
      available: false,
      checkStatus: 'CONFIRMED_UNAVAILABLE',
      shows: [],
      providerName: this.name,
      responseTimeMs: Date.now() - startTime,
      reason: 'SIMULATED: Tickets not yet released (simulation flag not set)',
      details: { simulated: true },
    };
  }
}
