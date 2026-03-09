// USPS v3 REST API Client for Node.js
// https://github.com/revereveal/usps-v3-node

export { USPSClient } from './client.js';

// Error classes
export {
  USPSError,
  AuthError,
  ValidationError,
  RateLimitError,
  APIError,
  NetworkError,
} from './errors.js';

// Types
export type {
  USPSClientConfig,
  AddressInput,
  ValidatedAddress,
  AddressValidationResult,
  CityStateResult,
  TrackingEvent,
  TrackingResult,
  LabelAddress,
  MailClass,
  LabelCreateOptions,
  LabelResult,
  LabelVoidResult,
  PriceQuoteOptions,
  RateQuote,
  PriceResult,
  InternationalPriceOptions,
  ServiceEstimate,
  StandardsResult,
  DropoffOptions,
  LocationResult,
  TokenStatus,
} from './types.js';
