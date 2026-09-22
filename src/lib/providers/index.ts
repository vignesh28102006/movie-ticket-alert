import { BookMyShowTicketProvider } from './bookmyshow.provider';
import { DistrictTicketProvider } from './district.provider';
import { MockTicketProvider } from './mock.provider';
import { CheckParams, ITicketProvider, ProviderCheckResult } from './ticket-provider.interface';

export * from './ticket-provider.interface';
export { MockTicketProvider } from './mock.provider';
export { BookMyShowTicketProvider } from './bookmyshow.provider';
export { DistrictTicketProvider } from './district.provider';

export class CompositeTicketProvider implements ITicketProvider {
  name = 'Composite Ticket Provider';

  private bmsProvider = new BookMyShowTicketProvider();
  private districtProvider = new DistrictTicketProvider();
  private mockProvider = new MockTicketProvider();

  async checkAvailability(params: CheckParams): Promise<ProviderCheckResult> {
    const mode = process.env.DEFAULT_TICKET_PROVIDER || 'mock';

    // simulateRelease/forceError always routed to mock (testing only)
    if (mode === 'mock' || params.simulateRelease || params.forceError) {
      return this.mockProvider.checkAvailability(params);
    }

    const platform = params.platform;

    if (platform === 'bookmyshow') {
      return this.bmsProvider.checkAvailability(params);
    }

    if (platform === 'district') {
      return this.districtProvider.checkAvailability(params);
    }

    // Platform is 'both': query both in parallel
    const [bmsResult, districtResult] = await Promise.all([
      this.bmsProvider.checkAvailability(params),
      this.districtProvider.checkAvailability(params),
    ]);

    // CONFIRMED_AVAILABLE wins — but only if at least one provider
    // actually returned confirmed availability (not just a different error)
    const confirmedAvailable =
      bmsResult.checkStatus === 'CONFIRMED_AVAILABLE' ||
      districtResult.checkStatus === 'CONFIRMED_AVAILABLE';

    if (confirmedAvailable) {
      const winningResult =
        bmsResult.checkStatus === 'CONFIRMED_AVAILABLE' ? bmsResult : districtResult;
      return {
        available: true,
        checkStatus: 'CONFIRMED_AVAILABLE',
        shows: [...bmsResult.shows, ...districtResult.shows],
        providerName: 'BookMyShow + District',
        responseTimeMs: Math.max(bmsResult.responseTimeMs, districtResult.responseTimeMs),
        language: winningResult.language || params.language,
        reason: `Tickets confirmed by: ${winningResult.providerName}`,
        details: { bms: bmsResult.details, district: districtResult.details },
      };
    }

    // Both blocked: return BLOCKED aggregate
    if (bmsResult.checkStatus === 'BLOCKED' && districtResult.checkStatus === 'BLOCKED') {
      return {
        available: false,
        checkStatus: 'BLOCKED',
        shows: [],
        providerName: 'BookMyShow + District',
        responseTimeMs: Math.max(bmsResult.responseTimeMs, districtResult.responseTimeMs),
        reason: 'Both BookMyShow and District blocked server-side requests.',
        details: { bms: bmsResult.details, district: districtResult.details },
      };
    }

    // Any error is TEMPORARY_ERROR (preserve for retry)
    if (
      bmsResult.checkStatus === 'TEMPORARY_ERROR' ||
      districtResult.checkStatus === 'TEMPORARY_ERROR'
    ) {
      return {
        available: false,
        checkStatus: 'TEMPORARY_ERROR',
        shows: [],
        providerName: 'BookMyShow + District',
        responseTimeMs: Math.max(bmsResult.responseTimeMs, districtResult.responseTimeMs),
        reason: `Temporary error: BMS=${bmsResult.reason}, District=${districtResult.reason}`,
        details: { bms: bmsResult.details, district: districtResult.details },
      };
    }

    // Both unavailable or movie not found
    return {
      available: false,
      checkStatus:
        bmsResult.checkStatus === 'CONFIRMED_UNAVAILABLE' ||
        districtResult.checkStatus === 'CONFIRMED_UNAVAILABLE'
          ? 'CONFIRMED_UNAVAILABLE'
          : 'MOVIE_NOT_FOUND',
      shows: [],
      providerName: 'BookMyShow + District',
      responseTimeMs: Math.max(bmsResult.responseTimeMs, districtResult.responseTimeMs),
      reason: `BMS: ${bmsResult.reason} | District: ${districtResult.reason}`,
      details: { bms: bmsResult.details, district: districtResult.details },
    };
  }
}

export const defaultTicketProvider = new CompositeTicketProvider();
