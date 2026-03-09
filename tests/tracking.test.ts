import { describe, it, expect, vi, afterEach } from 'vitest';
import { USPSClient } from '../src/client.js';
import { ValidationError } from '../src/errors.js';

function makeClient() {
  return new USPSClient({
    clientId: 'test-id',
    clientSecret: 'test-secret',
  });
}

function mockOAuthAndAPI(apiResponse: unknown) {
  const oauthResponse = {
    access_token: 'mock-token',
    token_type: 'Bearer',
    expires_in: 28800,
  };

  return vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TrackingAPI', () => {
  it('tracks a package', async () => {
    const mockResult = {
      statusCategory: 'Delivered',
      trackingEvents: [
        {
          eventType: 'Delivered',
          eventCity: 'NEW YORK',
          eventState: 'NY',
          eventTimestamp: '2026-03-08T14:30:00Z',
        },
      ],
    };

    mockOAuthAndAPI(mockResult);
    const client = makeClient();
    const result = await client.tracking.track('9400111899223033005282');

    expect(result.statusCategory).toBe('Delivered');
    expect(result.trackingEvents).toHaveLength(1);

    const url = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(url).toContain('/tracking/v3/tracking/9400111899223033005282');
    expect(url).toContain('expand=DETAIL');
  });

  it('supports SUMMARY expand option', async () => {
    mockOAuthAndAPI({ statusCategory: 'In Transit' });
    const client = makeClient();
    await client.tracking.track('9400111899223033005282', 'SUMMARY');

    const url = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(url).toContain('expand=SUMMARY');
  });

  it('throws ValidationError for empty tracking number', async () => {
    const client = makeClient();
    await expect(client.tracking.track('')).rejects.toThrow(ValidationError);
  });

  it('URL-encodes tracking numbers', async () => {
    mockOAuthAndAPI({ statusCategory: 'Pre-Shipment' });
    const client = makeClient();
    await client.tracking.track('EJ123456789US');

    const url = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(url).toContain('/tracking/v3/tracking/EJ123456789US');
  });
});
