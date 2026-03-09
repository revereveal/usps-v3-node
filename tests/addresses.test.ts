import { describe, it, expect, vi, afterEach } from 'vitest';
import { USPSClient } from '../src/client.js';
import { ValidationError } from '../src/errors.js';

function makeClient() {
  return new USPSClient({
    clientId: 'test-id',
    clientSecret: 'test-secret',
    baseUrl: 'https://apis.usps.com',
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

describe('AddressesAPI', () => {
  describe('validate', () => {
    it('validates an address', async () => {
      const mockResult = {
        address: {
          streetAddress: '1600 PENNSYLVANIA AVE NW',
          city: 'WASHINGTON',
          state: 'DC',
          ZIPCode: '20500',
        },
        additionalInfo: { DPVConfirmation: 'Y' },
      };

      mockOAuthAndAPI(mockResult);
      const client = makeClient();
      const result = await client.addresses.validate({
        streetAddress: '1600 Pennsylvania Ave NW',
        city: 'Washington',
        state: 'DC',
        ZIPCode: '20500',
      });

      expect(result.address.city).toBe('WASHINGTON');
      expect(result.address.ZIPCode).toBe('20500');

      // Verify the USPS API call URL
      const apiCall = vi.mocked(fetch).mock.calls[1];
      expect(apiCall[0]).toContain('/addresses/v3/address?');
      expect(apiCall[0]).toContain('streetAddress=1600+Pennsylvania+Ave+NW');
    });

    it('includes optional fields in query params', async () => {
      mockOAuthAndAPI({ address: {} });
      const client = makeClient();
      await client.addresses.validate({
        streetAddress: '123 Main St',
        secondaryAddress: 'Apt 4',
        city: 'New York',
        state: 'NY',
        ZIPCode: '10001',
        ZIPPlus4: '1234',
      });

      const url = vi.mocked(fetch).mock.calls[1][0] as string;
      expect(url).toContain('secondaryAddress=Apt+4');
      expect(url).toContain('ZIPPlus4=1234');
    });

    it('throws ValidationError when streetAddress is empty', async () => {
      const client = makeClient();
      await expect(
        client.addresses.validate({ streetAddress: '' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('cityState', () => {
    it('looks up city and state for a ZIP', async () => {
      const mockResult = { city: 'NEW YORK', state: 'NY', ZIPCode: '10001' };
      mockOAuthAndAPI(mockResult);

      const client = makeClient();
      const result = await client.addresses.cityState('10001');

      expect(result.city).toBe('NEW YORK');
      expect(result.state).toBe('NY');

      const url = vi.mocked(fetch).mock.calls[1][0] as string;
      expect(url).toContain('/addresses/v3/city-state?');
      expect(url).toContain('ZIPCode=10001');
    });

    it('throws ValidationError when zipCode is empty', async () => {
      const client = makeClient();
      await expect(client.addresses.cityState('')).rejects.toThrow(ValidationError);
    });
  });
});
