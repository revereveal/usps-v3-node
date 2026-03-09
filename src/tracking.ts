import type { TokenManager } from './auth.js';
import type { TrackingResult } from './types.js';
import { ValidationError } from './errors.js';
import { uspsRequest } from './request.js';

export class TrackingAPI {
  constructor(
    private tokens: TokenManager,
    private baseUrl: string,
    private timeout: number,
  ) {}

  /**
   * Get tracking details for a USPS package.
   * @param trackingNumber - USPS tracking number
   * @param expand - Detail level: 'DETAIL' (default) or 'SUMMARY'
   */
  async track(
    trackingNumber: string,
    expand: 'DETAIL' | 'SUMMARY' = 'DETAIL',
  ): Promise<TrackingResult> {
    if (!trackingNumber) {
      throw new ValidationError('trackingNumber is required', 'trackingNumber');
    }

    const params = new URLSearchParams({ expand });
    const token = await this.tokens.getOAuthToken();
    return uspsRequest<TrackingResult>(
      `${this.baseUrl}/tracking/v3/tracking/${encodeURIComponent(trackingNumber)}?${params}`,
      { method: 'GET', token, timeout: this.timeout },
    );
  }
}
