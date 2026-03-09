import type { USPSClientConfig, TokenStatus } from './types.js';
import { TokenManager } from './auth.js';
import { AddressesAPI } from './addresses.js';
import { TrackingAPI } from './tracking.js';
import { LabelsAPI } from './labels.js';
import { PricesAPI } from './prices.js';
import { StandardsAPI } from './standards.js';
import { LocationsAPI } from './locations.js';
import { ValidationError } from './errors.js';

const DEFAULT_BASE_URL = 'https://apis.usps.com';
const DEFAULT_TIMEOUT = 30_000;

/**
 * USPS v3 REST API client for Node.js.
 *
 * @example
 * ```ts
 * import { USPSClient } from 'usps-v3';
 *
 * const client = new USPSClient({
 *   clientId: process.env.USPS_CLIENT_ID,
 *   clientSecret: process.env.USPS_CLIENT_SECRET,
 * });
 *
 * const result = await client.addresses.validate({
 *   streetAddress: '1600 Pennsylvania Ave NW',
 *   city: 'Washington',
 *   state: 'DC',
 *   ZIPCode: '20500',
 * });
 * ```
 */
export class USPSClient {
  private tokenManager: TokenManager;

  /** Address validation and city-state lookup */
  readonly addresses: AddressesAPI;
  /** Package tracking */
  readonly tracking: TrackingAPI;
  /** Shipping label creation and voiding */
  readonly labels: LabelsAPI;
  /** Rate quotes (domestic and international) */
  readonly prices: PricesAPI;
  /** Delivery time estimates */
  readonly standards: StandardsAPI;
  /** Drop-off location finder */
  readonly locations: LocationsAPI;

  constructor(config: USPSClientConfig = {}) {
    const clientId = config.clientId ?? env('USPS_CLIENT_ID');
    const clientSecret = config.clientSecret ?? env('USPS_CLIENT_SECRET');
    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    if (!clientId || !clientSecret) {
      throw new ValidationError(
        'USPS credentials required. Pass clientId/clientSecret in config ' +
        'or set USPS_CLIENT_ID/USPS_CLIENT_SECRET environment variables.'
      );
    }

    this.tokenManager = new TokenManager({
      clientId,
      clientSecret,
      baseUrl,
      crid: config.crid ?? env('USPS_CRID'),
      masterMid: config.masterMid ?? env('USPS_MASTER_MID'),
      labelMid: config.labelMid ?? env('USPS_LABEL_MID'),
      epaAccount: config.epaAccount ?? env('USPS_EPA_ACCOUNT'),
    });

    this.addresses = new AddressesAPI(this.tokenManager, baseUrl, timeout);
    this.tracking = new TrackingAPI(this.tokenManager, baseUrl, timeout);
    this.labels = new LabelsAPI(this.tokenManager, baseUrl, timeout);
    this.prices = new PricesAPI(this.tokenManager, baseUrl, timeout);
    this.standards = new StandardsAPI(this.tokenManager, baseUrl, timeout);
    this.locations = new LocationsAPI(this.tokenManager, baseUrl, timeout);
  }

  /** Current token status (validity and time-to-live) */
  get tokenStatus(): TokenStatus {
    return this.tokenManager.status;
  }

  /** Force refresh all cached tokens */
  async refreshTokens(): Promise<void> {
    return this.tokenManager.forceRefresh();
  }

  /** Clear cached tokens */
  close(): void {
    this.tokenManager.clear();
  }
}

/** Safe env var lookup (works in Node, Deno, Bun, and edge runtimes) */
function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}
