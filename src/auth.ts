import { AuthError } from './errors.js';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
}

interface PaymentTokenCache {
  paymentToken: string;
  expiresAt: number;
}

interface TokenManagerConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  crid?: string;
  masterMid?: string;
  labelMid?: string;
  epaAccount?: string;
}

const EXPIRY_BUFFER_MS = 30 * 60 * 1000; // 30 minutes before expiry

/**
 * Manages OAuth 2.0 and Payment Authorization tokens for USPS v3 API.
 *
 * OAuth tokens use client_credentials grant and last 8 hours (28800s).
 * Payment tokens are required only for label creation and also last 8 hours.
 * Both are refreshed proactively 30 minutes before expiry.
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private oauthCache: TokenCache | null = null;
  private paymentCache: PaymentTokenCache | null = null;
  private oauthPromise: Promise<string> | null = null;
  private paymentPromise: Promise<string> | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
  }

  /** Get a valid OAuth bearer token, refreshing if needed */
  async getOAuthToken(): Promise<string> {
    if (this.oauthCache && Date.now() < this.oauthCache.expiresAt - EXPIRY_BUFFER_MS) {
      return this.oauthCache.accessToken;
    }

    // Deduplicate concurrent refresh calls
    if (!this.oauthPromise) {
      this.oauthPromise = this.refreshOAuth().finally(() => {
        this.oauthPromise = null;
      });
    }
    return this.oauthPromise;
  }

  /** Get a valid Payment Authorization token, refreshing if needed */
  async getPaymentToken(): Promise<string> {
    if (!this.config.crid) {
      throw new AuthError(
        'Payment Authorization requires CRID, MIDs, and EPA. ' +
        'Set crid, masterMid, labelMid, and epaAccount in client config.'
      );
    }

    if (this.paymentCache && Date.now() < this.paymentCache.expiresAt - EXPIRY_BUFFER_MS) {
      return this.paymentCache.paymentToken;
    }

    if (!this.paymentPromise) {
      this.paymentPromise = this.refreshPayment().finally(() => {
        this.paymentPromise = null;
      });
    }
    return this.paymentPromise;
  }

  /** Get both tokens (for label creation) */
  async getBothTokens(): Promise<{ accessToken: string; paymentToken: string }> {
    const [accessToken, paymentToken] = await Promise.all([
      this.getOAuthToken(),
      this.getPaymentToken(),
    ]);
    return { accessToken, paymentToken };
  }

  /** Force refresh both tokens */
  async forceRefresh(): Promise<void> {
    this.oauthCache = null;
    this.paymentCache = null;
    await this.getOAuthToken();
    if (this.config.crid) {
      await this.getPaymentToken();
    }
  }

  /** Current token status */
  get status(): { hasOAuthToken: boolean; oauthExpiresIn?: number; hasPaymentToken: boolean; paymentExpiresIn?: number } {
    const now = Date.now();
    return {
      hasOAuthToken: !!this.oauthCache && now < this.oauthCache.expiresAt,
      oauthExpiresIn: this.oauthCache ? Math.max(0, Math.floor((this.oauthCache.expiresAt - now) / 1000)) : undefined,
      hasPaymentToken: !!this.paymentCache && now < this.paymentCache.expiresAt,
      paymentExpiresIn: this.paymentCache ? Math.max(0, Math.floor((this.paymentCache.expiresAt - now) / 1000)) : undefined,
    };
  }

  /** Clear cached tokens */
  clear(): void {
    this.oauthCache = null;
    this.paymentCache = null;
  }

  private async refreshOAuth(): Promise<string> {
    const url = `${this.config.baseUrl}/oauth2/v3/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'addresses tracking labels prices service-standards locations',
    });

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new AuthError(`OAuth token request failed: ${(err as Error).message}`);
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new AuthError(`OAuth token request returned ${resp.status}: ${text}`, resp.status);
    }

    const data = await resp.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
      scope?: string;
    };

    this.oauthCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope,
    };

    return data.access_token;
  }

  private async refreshPayment(): Promise<string> {
    const oauthToken = await this.getOAuthToken();
    const url = `${this.config.baseUrl}/payments/v3/payment-authorization`;

    const payload = {
      roles: [
        {
          roleName: 'PAYER',
          CRID: this.config.crid,
          MID: this.config.masterMid,
          manifestMID: this.config.labelMid,
          accountType: 'EPS',
          accountNumber: this.config.epaAccount,
        },
        {
          roleName: 'LABEL_OWNER',
          CRID: this.config.crid,
          MID: this.config.labelMid,
          manifestMID: this.config.labelMid,
          accountType: 'EPS',
          accountNumber: this.config.epaAccount,
        },
      ],
    };

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new AuthError(`Payment token request failed: ${(err as Error).message}`);
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new AuthError(`Payment token request returned ${resp.status}: ${text}`, resp.status);
    }

    const data = await resp.json() as {
      paymentAuthorizationToken: string;
      expires_in?: number;
    };

    // Payment tokens also last ~8 hours (28800s)
    const expiresIn = data.expires_in ?? 28800;

    this.paymentCache = {
      paymentToken: data.paymentAuthorizationToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return data.paymentAuthorizationToken;
  }
}
