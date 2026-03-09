import { describe, it, expect, vi, afterEach } from 'vitest';
import { USPSClient } from '../src/client.js';
import { ValidationError } from '../src/errors.js';

function makeClient() {
  return new USPSClient({ clientId: 'test-id', clientSecret: 'test-secret' });
}

function mockOAuthAndAPI(apiResponse: unknown) {
  const oauthResponse = { access_token: 'mock-token', token_type: 'Bearer', expires_in: 28800 };
  return vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

afterEach(() => { vi.restoreAllMocks(); });

describe('StandardsAPI', () => {
  it('gets delivery estimates', async () => {
    const mockEstimates = {
      estimates: [
        { mailClass: 'PRIORITY_MAIL', daysToDelivery: 2 },
        { mailClass: 'USPS_GROUND_ADVANTAGE', daysToDelivery: 5 },
      ],
    };

    mockOAuthAndAPI(mockEstimates);
    const client = makeClient();
    const result = await client.standards.estimates('10001', '90210');

    expect(result.estimates).toHaveLength(2);
    expect(result.estimates[0].daysToDelivery).toBe(2);

    const url = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(url).toContain('/service-standards/v3/estimates?');
    expect(url).toContain('originZIPCode=10001');
    expect(url).toContain('destinationZIPCode=90210');
  });

  it('includes optional mailClass filter', async () => {
    mockOAuthAndAPI({ estimates: [] });
    const client = makeClient();
    await client.standards.estimates('10001', '90210', { mailClass: 'PRIORITY_MAIL' });

    const url = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(url).toContain('mailClass=PRIORITY_MAIL');
  });

  it('throws ValidationError for missing origin', async () => {
    const client = makeClient();
    await expect(client.standards.estimates('', '90210')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for missing destination', async () => {
    const client = makeClient();
    await expect(client.standards.estimates('10001', '')).rejects.toThrow(ValidationError);
  });
});
