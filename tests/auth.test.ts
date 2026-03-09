import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenManager } from '../src/auth.js';
import { AuthError } from '../src/errors.js';

function makeTokenManager(overrides = {}) {
  return new TokenManager({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    baseUrl: 'https://apis.usps.com',
    ...overrides,
  });
}

describe('TokenManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches OAuth token on first call', async () => {
    const mockResponse = {
      access_token: 'test-oauth-token',
      token_type: 'Bearer',
      expires_in: 28800,
      scope: 'addresses tracking',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const tm = makeTokenManager();
    const token = await tm.getOAuthToken();

    expect(token).toBe('test-oauth-token');
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://apis.usps.com/oauth2/v3/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('caches OAuth token on subsequent calls', async () => {
    const mockResponse = {
      access_token: 'cached-token',
      token_type: 'Bearer',
      expires_in: 28800,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const tm = makeTokenManager();
    const token1 = await tm.getOAuthToken();
    const token2 = await tm.getOAuthToken();

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(fetch).toHaveBeenCalledOnce(); // Only one fetch
  });

  it('deduplicates concurrent refresh calls', async () => {
    const mockResponse = {
      access_token: 'deduped-token',
      token_type: 'Bearer',
      expires_in: 28800,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const tm = makeTokenManager();
    const [token1, token2, token3] = await Promise.all([
      tm.getOAuthToken(),
      tm.getOAuthToken(),
      tm.getOAuthToken(),
    ]);

    expect(token1).toBe('deduped-token');
    expect(token2).toBe('deduped-token');
    expect(token3).toBe('deduped-token');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('throws AuthError on OAuth failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Invalid client', { status: 401 }),
    );

    const tm = makeTokenManager();
    try {
      await tm.getOAuthToken();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).message).toMatch(/401/);
    }
  });

  it('throws AuthError when getPaymentToken called without CRID', async () => {
    const tm = makeTokenManager(); // No CRID
    await expect(tm.getPaymentToken()).rejects.toThrow(AuthError);
    await expect(tm.getPaymentToken()).rejects.toThrow(/CRID/);
  });

  it('fetches payment token when CRID is set', async () => {
    const oauthResponse = {
      access_token: 'oauth-token',
      token_type: 'Bearer',
      expires_in: 28800,
    };
    const paymentResponse = {
      paymentAuthorizationToken: 'payment-token-123',
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(paymentResponse), { status: 200 }));

    const tm = makeTokenManager({
      crid: '56982563',
      masterMid: '904128936',
      labelMid: '904128937',
      epaAccount: '1000405525',
    });

    const token = await tm.getPaymentToken();
    expect(token).toBe('payment-token-123');
    expect(fetch).toHaveBeenCalledTimes(2); // OAuth + Payment
  });

  it('getBothTokens returns both tokens', async () => {
    const oauthResponse = {
      access_token: 'both-oauth',
      token_type: 'Bearer',
      expires_in: 28800,
    };
    const paymentResponse = {
      paymentAuthorizationToken: 'both-payment',
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(paymentResponse), { status: 200 }));

    const tm = makeTokenManager({
      crid: '56982563',
      masterMid: '904128936',
      labelMid: '904128937',
      epaAccount: '1000405525',
    });

    const result = await tm.getBothTokens();
    expect(result.accessToken).toBe('both-oauth');
    expect(result.paymentToken).toBe('both-payment');
  });

  it('status reflects token state', async () => {
    const mockResponse = {
      access_token: 'status-token',
      token_type: 'Bearer',
      expires_in: 28800,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const tm = makeTokenManager();

    // Before any token fetch
    expect(tm.status.hasOAuthToken).toBe(false);

    await tm.getOAuthToken();

    // After fetch
    expect(tm.status.hasOAuthToken).toBe(true);
    expect(tm.status.oauthExpiresIn).toBeGreaterThan(28000);
  });

  it('clear() invalidates cached tokens', async () => {
    const mockResponse = {
      access_token: 'clearable-token',
      token_type: 'Bearer',
      expires_in: 28800,
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));

    const tm = makeTokenManager();
    await tm.getOAuthToken();
    expect(tm.status.hasOAuthToken).toBe(true);

    tm.clear();
    expect(tm.status.hasOAuthToken).toBe(false);

    // Next call should fetch again
    await tm.getOAuthToken();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('handles network errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('DNS resolution failed'));

    const tm = makeTokenManager();
    try {
      await tm.getOAuthToken();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).message).toMatch(/DNS resolution failed/);
    }
  });
});
