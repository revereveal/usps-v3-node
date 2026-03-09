import type { TokenManager } from './auth.js';
import type { PriceQuoteOptions, PriceResult, InternationalPriceOptions } from './types.js';
import { ValidationError } from './errors.js';
import { uspsRequest } from './request.js';

export class PricesAPI {
  constructor(
    private tokens: TokenManager,
    private baseUrl: string,
    private timeout: number,
  ) {}

  /**
   * Get domestic rate quotes for a shipment.
   */
  async domestic(options: PriceQuoteOptions): Promise<PriceResult> {
    if (!options.originZIPCode) {
      throw new ValidationError('originZIPCode is required', 'originZIPCode');
    }
    if (!options.destinationZIPCode) {
      throw new ValidationError('destinationZIPCode is required', 'destinationZIPCode');
    }
    if (!options.weight || options.weight <= 0) {
      throw new ValidationError('weight must be greater than 0', 'weight');
    }

    const body = {
      originZIPCode: options.originZIPCode,
      destinationZIPCode: options.destinationZIPCode,
      weight: options.weight,
      length: options.length ?? 6,
      width: options.width ?? 4,
      height: options.height ?? 1,
      ...(options.mailClass && { mailClass: options.mailClass }),
      ...(options.processingCategory && { processingCategory: options.processingCategory }),
      ...(options.rateIndicator && { rateIndicator: options.rateIndicator }),
      ...(options.priceType && { priceType: options.priceType }),
      ...(options.mailingDate && { mailingDate: options.mailingDate }),
      ...(options.accountType && { accountType: options.accountType }),
      ...(options.accountNumber && { accountNumber: options.accountNumber }),
      ...(options.itemValue != null && { itemValue: options.itemValue }),
      ...(options.extraServices && { extraServices: options.extraServices }),
    };

    const token = await this.tokens.getOAuthToken();
    return uspsRequest<PriceResult>(
      `${this.baseUrl}/prices/v3/total-rates/search`,
      { method: 'POST', token, timeout: this.timeout, body },
    );
  }

  /**
   * Get international rate quotes for a shipment.
   */
  async international(options: InternationalPriceOptions): Promise<PriceResult> {
    if (!options.originZIPCode) {
      throw new ValidationError('originZIPCode is required', 'originZIPCode');
    }
    if (!options.destinationCountryCode) {
      throw new ValidationError('destinationCountryCode is required', 'destinationCountryCode');
    }
    if (!options.weight || options.weight <= 0) {
      throw new ValidationError('weight must be greater than 0', 'weight');
    }

    const body = {
      originZIPCode: options.originZIPCode,
      foreignPostalCode: options.destinationCountryCode,
      destinationCountryCode: options.destinationCountryCode,
      weight: options.weight,
      length: options.length ?? 6,
      width: options.width ?? 4,
      height: options.height ?? 1,
      ...(options.mailClass && { mailClass: options.mailClass }),
      ...(options.priceType && { priceType: options.priceType }),
      ...(options.mailingDate && { mailingDate: options.mailingDate }),
      ...(options.accountType && { accountType: options.accountType }),
      ...(options.accountNumber && { accountNumber: options.accountNumber }),
      ...(options.itemValue != null && { itemValue: options.itemValue }),
      ...(options.extraServices && { extraServices: options.extraServices }),
    };

    const token = await this.tokens.getOAuthToken();
    return uspsRequest<PriceResult>(
      `${this.baseUrl}/prices/v3/total-rates/search`,
      { method: 'POST', token, timeout: this.timeout, body },
    );
  }
}
