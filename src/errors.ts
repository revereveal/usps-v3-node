/** Base error for all USPS SDK errors */
export class USPSError extends Error {
  readonly statusCode?: number;
  readonly responseBody?: unknown;

  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message);
    this.name = 'USPSError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/** OAuth or Payment Authorization failure */
export class AuthError extends USPSError {
  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
    this.name = 'AuthError';
  }
}

/** Invalid request parameters */
export class ValidationError extends USPSError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/** USPS rate limit exceeded (429) */
export class RateLimitError extends USPSError {
  readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** USPS API returned an error response */
export class APIError extends USPSError {
  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
    this.name = 'APIError';
  }
}

/** Network/transport error (timeout, DNS, connection refused) */
export class NetworkError extends USPSError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
