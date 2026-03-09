// USPS v3 REST API type definitions

// --- Client Configuration ---

export interface USPSClientConfig {
  /** OAuth client ID from USPS Developer Portal */
  clientId?: string;
  /** OAuth client secret from USPS Developer Portal */
  clientSecret?: string;
  /** USPS base URL (default: https://apis.usps.com) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Customer Registration ID for Payment Auth */
  crid?: string;
  /** Master Mailer ID */
  masterMid?: string;
  /** Label Mailer ID */
  labelMid?: string;
  /** Enterprise Payment Account number */
  epaAccount?: string;
}

// --- Address Types ---

export interface AddressInput {
  streetAddress: string;
  secondaryAddress?: string;
  city?: string;
  state?: string;
  ZIPCode?: string;
  ZIPPlus4?: string;
}

export interface ValidatedAddress {
  streetAddress: string;
  secondaryAddress?: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
}

export interface AddressValidationResult {
  address: ValidatedAddress;
  additionalInfo?: {
    deliveryPoint?: string;
    DPVConfirmation?: string;
    business?: 'Y' | 'N';
    vacant?: boolean;
  };
  corrections?: unknown[];
  matches?: unknown[];
}

export interface CityStateResult {
  city: string;
  state: string;
  ZIPCode: string;
  [key: string]: unknown;
}

// --- Tracking Types ---

export interface TrackingEvent {
  eventType?: string;
  eventCode?: string;
  eventCity?: string;
  eventState?: string;
  eventZIP?: string;
  eventTimestamp?: string;
}

export interface TrackingResult {
  statusCategory: string;
  trackingEvents?: TrackingEvent[];
  [key: string]: unknown;
}

// --- Label Types ---

export interface LabelAddress {
  streetAddress: string;
  secondaryAddress?: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
  firstName?: string;
  lastName?: string;
  firm?: string;
}

export type MailClass =
  | 'PRIORITY_MAIL_EXPRESS'
  | 'PRIORITY_MAIL'
  | 'FIRST-CLASS_PACKAGE_SERVICE'
  | 'PARCEL_SELECT'
  | 'LIBRARY_MAIL'
  | 'MEDIA_MAIL'
  | 'BOUND_PRINTED_MATTER'
  | 'USPS_GROUND_ADVANTAGE';

export interface LabelCreateOptions {
  fromAddress: LabelAddress;
  toAddress: LabelAddress;
  mailClass: MailClass | string;
  weight: number;
  imageType?: 'PDF' | 'PNG';
  labelType?: string;
  rateIndicator?: string;
  processingCategory?: 'MACHINABLE' | 'NON_MACHINABLE';
  length?: number;
  width?: number;
  height?: number;
  mailingDate?: string;
  extraServices?: Record<string, unknown>[];
  packageValue?: number;
  returnLabel?: boolean;
  idempotencyKey?: string;
}

export interface LabelResult {
  trackingNumber: string;
  postage: number;
  zone?: string;
  commitment?: {
    name: string;
    value?: string;
  };
  SKU?: string;
  labelImage?: ArrayBuffer;
  [key: string]: unknown;
}

export interface LabelVoidResult {
  status: string;
  [key: string]: unknown;
}

// --- Pricing Types ---

export interface PriceQuoteOptions {
  originZIPCode: string;
  destinationZIPCode: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  mailClass?: string;
  processingCategory?: string;
  rateIndicator?: string;
  priceType?: 'RETAIL' | 'COMMERCIAL';
  mailingDate?: string;
  accountType?: string;
  accountNumber?: string;
  itemValue?: number;
  extraServices?: Record<string, unknown>[];
}

export interface RateQuote {
  mailClass: string;
  price: number;
  commitment?: {
    name: string;
    scheduledDeliveryDate?: string;
  };
  [key: string]: unknown;
}

export interface PriceResult {
  rates: Record<string, RateQuote[]>;
  input: {
    origin: string;
    destination: string;
    weight: number;
  };
  [key: string]: unknown;
}

export interface InternationalPriceOptions extends Omit<PriceQuoteOptions, 'destinationZIPCode'> {
  destinationCountryCode: string;
}

// --- Service Standards Types ---

export interface ServiceEstimate {
  mailClass: string;
  daysToDelivery: number;
  scheduledDeliveryDate?: string;
  [key: string]: unknown;
}

export interface StandardsResult {
  estimates: ServiceEstimate[];
  [key: string]: unknown;
}

// --- Locations Types ---

export interface DropoffOptions {
  destinationZIP: string;
  mailClass?: string;
  originZIP?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

export interface LocationResult {
  [key: string]: unknown;
}

// --- Token State ---

export interface TokenStatus {
  hasOAuthToken: boolean;
  oauthExpiresIn?: number;
  hasPaymentToken: boolean;
  paymentExpiresIn?: number;
}
