import type { TokenManager } from './auth.js';
import type { DropoffOptions, LocationResult } from './types.js';
import { ValidationError } from './errors.js';
import { uspsRequest } from './request.js';

export class LocationsAPI {
  constructor(
    private tokens: TokenManager,
    private baseUrl: string,
    private timeout: number,
  ) {}

  /**
   * Find USPS drop-off locations (post offices, collection boxes, retailers).
   */
  async dropoff(options: DropoffOptions): Promise<LocationResult> {
    if (!options.destinationZIP) {
      throw new ValidationError('destinationZIP is required', 'destinationZIP');
    }

    const params = new URLSearchParams({
      destinationZIPCode: options.destinationZIP,
      mailClass: options.mailClass ?? 'PARCEL_SELECT',
    });
    if (options.originZIP) params.set('originZIPCode', options.originZIP);
    if (options.weight != null) params.set('weight', String(options.weight));
    if (options.length != null) params.set('length', String(options.length));
    if (options.width != null) params.set('width', String(options.width));
    if (options.height != null) params.set('height', String(options.height));

    const token = await this.tokens.getOAuthToken();
    return uspsRequest<LocationResult>(
      `${this.baseUrl}/locations/v3/dropoff-locations?${params}`,
      { method: 'GET', token, timeout: this.timeout },
    );
  }
}
