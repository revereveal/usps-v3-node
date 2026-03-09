import type { TokenManager } from './auth.js';
import type { StandardsResult } from './types.js';
import { ValidationError } from './errors.js';
import { uspsRequest } from './request.js';

export class StandardsAPI {
  constructor(
    private tokens: TokenManager,
    private baseUrl: string,
    private timeout: number,
  ) {}

  /**
   * Get delivery time estimates between two ZIP codes.
   * Optionally filter by mail class.
   */
  async estimates(
    originZIP: string,
    destinationZIP: string,
    options?: { mailClass?: string; acceptanceDate?: string },
  ): Promise<StandardsResult> {
    if (!originZIP) {
      throw new ValidationError('originZIP is required', 'originZIP');
    }
    if (!destinationZIP) {
      throw new ValidationError('destinationZIP is required', 'destinationZIP');
    }

    const params = new URLSearchParams({
      originZIPCode: originZIP,
      destinationZIPCode: destinationZIP,
    });
    if (options?.mailClass) params.set('mailClass', options.mailClass);
    if (options?.acceptanceDate) params.set('acceptanceDate', options.acceptanceDate);

    const token = await this.tokens.getOAuthToken();
    return uspsRequest<StandardsResult>(
      `${this.baseUrl}/service-standards/v3/estimates?${params}`,
      { method: 'GET', token, timeout: this.timeout },
    );
  }
}
