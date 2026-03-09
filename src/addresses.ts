import type { TokenManager } from './auth.js';
import type { AddressInput, AddressValidationResult, CityStateResult } from './types.js';
import { ValidationError } from './errors.js';
import { uspsRequest } from './request.js';

export class AddressesAPI {
  constructor(
    private tokens: TokenManager,
    private baseUrl: string,
    private timeout: number,
  ) {}

  /**
   * Validate and standardize a US address against the USPS database.
   * Returns the corrected address with delivery point info.
   */
  async validate(input: AddressInput): Promise<AddressValidationResult> {
    if (!input.streetAddress) {
      throw new ValidationError('streetAddress is required', 'streetAddress');
    }

    const params = new URLSearchParams();
    params.set('streetAddress', input.streetAddress);
    if (input.secondaryAddress) params.set('secondaryAddress', input.secondaryAddress);
    if (input.city) params.set('city', input.city);
    if (input.state) params.set('state', input.state);
    if (input.ZIPCode) params.set('ZIPCode', input.ZIPCode);
    if (input.ZIPPlus4) params.set('ZIPPlus4', input.ZIPPlus4);

    const token = await this.tokens.getOAuthToken();
    return uspsRequest<AddressValidationResult>(
      `${this.baseUrl}/addresses/v3/address?${params}`,
      { method: 'GET', token, timeout: this.timeout },
    );
  }

  /**
   * Look up city and state for a given ZIP code.
   */
  async cityState(zipCode: string): Promise<CityStateResult> {
    if (!zipCode) {
      throw new ValidationError('zipCode is required', 'zipCode');
    }

    const params = new URLSearchParams({ ZIPCode: zipCode });
    const token = await this.tokens.getOAuthToken();
    return uspsRequest<CityStateResult>(
      `${this.baseUrl}/addresses/v3/city-state?${params}`,
      { method: 'GET', token, timeout: this.timeout },
    );
  }
}
