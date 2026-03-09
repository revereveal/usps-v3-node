import type { TokenManager } from './auth.js';
import type { LabelCreateOptions, LabelResult, LabelVoidResult } from './types.js';
import { ValidationError, AuthError } from './errors.js';
import { uspsRequest } from './request.js';

const VALID_MAIL_CLASSES = new Set([
  'PRIORITY_MAIL_EXPRESS',
  'PRIORITY_MAIL',
  'FIRST-CLASS_PACKAGE_SERVICE',
  'PARCEL_SELECT',
  'LIBRARY_MAIL',
  'MEDIA_MAIL',
  'BOUND_PRINTED_MATTER',
  'USPS_GROUND_ADVANTAGE',
]);

export class LabelsAPI {
  constructor(
    private tokens: TokenManager,
    private baseUrl: string,
    private timeout: number,
  ) {}

  /**
   * Create a shipping label. Requires Payment Authorization token.
   * USPS credentials must include CRID, MIDs, and EPA for payment auth.
   */
  async create(options: LabelCreateOptions): Promise<LabelResult> {
    if (!options.fromAddress?.streetAddress) {
      throw new ValidationError('fromAddress.streetAddress is required', 'fromAddress');
    }
    if (!options.toAddress?.streetAddress) {
      throw new ValidationError('toAddress.streetAddress is required', 'toAddress');
    }
    if (!options.mailClass) {
      throw new ValidationError('mailClass is required', 'mailClass');
    }
    if (!options.weight || options.weight <= 0) {
      throw new ValidationError('weight must be greater than 0', 'weight');
    }
    if (VALID_MAIL_CLASSES.size > 0 && !VALID_MAIL_CLASSES.has(options.mailClass)) {
      // Allow unknown mail classes but warn-worthy
    }

    let tokens: { accessToken: string; paymentToken: string };
    try {
      tokens = await this.tokens.getBothTokens();
    } catch (err) {
      if (err instanceof AuthError) {
        throw new AuthError(
          'Label creation requires Payment Authorization. ' +
          'Ensure crid, masterMid, labelMid, and epaAccount are configured. ' +
          `Original error: ${err.message}`
        );
      }
      throw err;
    }

    const today = new Date().toISOString().split('T')[0];
    const body = {
      fromAddress: options.fromAddress,
      toAddress: options.toAddress,
      mailClass: options.mailClass,
      weight: options.weight,
      weightUOM: 'lb',
      dimensionsUOM: 'in',
      length: options.length ?? 12,
      width: options.width ?? 9,
      height: options.height ?? 1,
      imageType: options.imageType ?? 'PDF',
      labelType: options.labelType ?? '4X6LABEL',
      receiptOption: 'NONE',
      rateIndicator: options.rateIndicator ?? 'SP',
      processingCategory: options.processingCategory ?? 'MACHINABLE',
      destinationEntryFacilityType: 'NONE',
      mailingDate: options.mailingDate ?? today,
      returnLabel: options.returnLabel ?? false,
      ...(options.extraServices && { extraServices: options.extraServices }),
      ...(options.packageValue != null && { packageValue: options.packageValue }),
    };

    const headers: Record<string, string> = {
      'X-Payment-Authorization-Token': tokens.paymentToken,
    };
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    return uspsRequest<LabelResult>(
      `${this.baseUrl}/labels/v3/label`,
      {
        method: 'POST',
        token: tokens.accessToken,
        timeout: this.timeout,
        body,
        headers,
      },
    );
  }

  /**
   * Void/refund a label by tracking number.
   */
  async void(trackingNumber: string): Promise<LabelVoidResult> {
    if (!trackingNumber) {
      throw new ValidationError('trackingNumber is required', 'trackingNumber');
    }

    const token = await this.tokens.getOAuthToken();
    return uspsRequest<LabelVoidResult>(
      `${this.baseUrl}/labels/v3/label/${encodeURIComponent(trackingNumber)}`,
      { method: 'DELETE', token, timeout: this.timeout },
    );
  }
}
