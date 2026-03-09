import { describe, it, expect, vi, afterEach } from 'vitest';
import { uspsRequest } from '../src/request.js';
import { APIError, RateLimitError, AuthError, NetworkError } from '../src/errors.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uspsRequest', () => {
  it('sends GET request with auth header', async () => {
    const mockData = { address: { city: 'Washington' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await uspsRequest('https://apis.usps.com/addresses/v3/address?streetAddress=test', {
      method: 'GET',
      token: 'bearer-token-123',
      timeout: 30000,
    });

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      'https://apis.usps.com/addresses/v3/address?streetAddress=test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-token-123',
        }),
      }),
    );
  });

  it('sends POST request with JSON body', async () => {
    const mockData = { rates: {} };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await uspsRequest('https://apis.usps.com/prices/v3/total-rates/search', {
      method: 'POST',
      token: 'token',
      timeout: 30000,
      body: { originZIPCode: '10001', weight: 2.5 },
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const init = fetchCall[1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ originZIPCode: '10001', weight: 2.5 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('includes extra headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await uspsRequest('https://apis.usps.com/labels/v3/label', {
      method: 'POST',
      token: 'token',
      timeout: 30000,
      body: {},
      headers: { 'X-Payment-Authorization-Token': 'pay-token' },
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const init = fetchCall[1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Payment-Authorization-Token']).toBe('pay-token');
  });

  it('throws RateLimitError on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '3600' },
      }),
    );

    await expect(
      uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'tok', timeout: 30000 }),
    ).rejects.toThrow(RateLimitError);

    try {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Rate limited', {
          status: 429,
          headers: { 'Retry-After': '3600' },
        }),
      );
      await uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'tok', timeout: 30000 });
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(3600);
    }
  });

  it('throws AuthError on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(
      uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'bad', timeout: 30000 }),
    ).rejects.toThrow(AuthError);
  });

  it('throws AuthError on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    await expect(
      uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'bad', timeout: 30000 }),
    ).rejects.toThrow(AuthError);
  });

  it('throws APIError on other error status codes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Bad ZIP' } }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'tok', timeout: 30000 }),
    ).rejects.toThrow(APIError);
  });

  it('throws NetworkError on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'tok', timeout: 30000 }),
    ).rejects.toThrow(NetworkError);
  });

  it('throws NetworkError on timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

    await expect(
      uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'tok', timeout: 100 }),
    ).rejects.toThrow(NetworkError);

    try {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));
      await uspsRequest('https://apis.usps.com/test', { method: 'GET', token: 'tok', timeout: 100 });
    } catch (err) {
      expect((err as NetworkError).message).toMatch(/timed out/i);
    }
  });
});
