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

describe('PricesAPI', () => {
  describe('domestic', () => {
    it('gets domestic rate quotes', async () => {
      const mockRates = {
        rates: {
          PRIORITY_MAIL: [{ mailClass: 'PRIORITY_MAIL', price: 8.50 }],
          USPS_GROUND_ADVANTAGE: [{ mailClass: 'USPS_GROUND_ADVANTAGE', price: 5.25 }],
        },
        input: { origin: '10001', destination: '90210', weight: 2.5 },
      };

      mockOAuthAndAPI(mockRates);
      const client = makeClient();
      const result = await client.prices.domestic({
        originZIPCode: '10001',
        destinationZIPCode: '90210',
        weight: 2.5,
      });

      expect(result.rates.PRIORITY_MAIL[0].price).toBe(8.50);
      expect(result.input.weight).toBe(2.5);

      const apiCall = vi.mocked(fetch).mock.calls[1];
      expect(apiCall[0]).toContain('/prices/v3/total-rates/search');
      expect((apiCall[1] as RequestInit).method).toBe('POST');
    });

    it('includes optional fields in body', async () => {
      mockOAuthAndAPI({ rates: {} });
      const client = makeClient();
      await client.prices.domestic({
        originZIPCode: '10001',
        destinationZIPCode: '90210',
        weight: 1.0,
        mailClass: 'PRIORITY_MAIL',
        priceType: 'COMMERCIAL',
      });

      const apiCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse((apiCall[1] as RequestInit).body as string);
      expect(body.mailClass).toBe('PRIORITY_MAIL');
      expect(body.priceType).toBe('COMMERCIAL');
    });

    it('throws ValidationError for missing origin', async () => {
      const client = makeClient();
      await expect(
        client.prices.domestic({ originZIPCode: '', destinationZIPCode: '90210', weight: 1 }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for zero weight', async () => {
      const client = makeClient();
      await expect(
        client.prices.domestic({ originZIPCode: '10001', destinationZIPCode: '90210', weight: 0 }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('international', () => {
    it('gets international rate quotes', async () => {
      const mockRates = {
        rates: {
          PRIORITY_MAIL_INTERNATIONAL: [{ mailClass: 'PRIORITY_MAIL_INTERNATIONAL', price: 45.00 }],
        },
      };

      mockOAuthAndAPI(mockRates);
      const client = makeClient();
      const result = await client.prices.international({
        originZIPCode: '10001',
        destinationCountryCode: 'GB',
        weight: 3.0,
      });

      expect(result.rates.PRIORITY_MAIL_INTERNATIONAL).toBeDefined();

      const apiCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse((apiCall[1] as RequestInit).body as string);
      expect(body.destinationCountryCode).toBe('GB');
    });

    it('throws ValidationError for missing country code', async () => {
      const client = makeClient();
      await expect(
        client.prices.international({ originZIPCode: '10001', destinationCountryCode: '', weight: 1 }),
      ).rejects.toThrow(ValidationError);
    });
  });
});
