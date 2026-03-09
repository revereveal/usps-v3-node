import { describe, it, expect, vi, afterEach } from 'vitest';
import { USPSClient } from '../src/client.js';
import { ValidationError, AuthError } from '../src/errors.js';

function makeClient(withPaymentCreds = false) {
  return new USPSClient({
    clientId: 'test-id',
    clientSecret: 'test-secret',
    ...(withPaymentCreds && {
      crid: '56982563',
      masterMid: '904128936',
      labelMid: '904128937',
      epaAccount: '1000405525',
    }),
  });
}

function mockBothTokensAndAPI(apiResponse: unknown) {
  const oauthResponse = {
    access_token: 'oauth-token',
    token_type: 'Bearer',
    expires_in: 28800,
  };
  const paymentResponse = {
    paymentAuthorizationToken: 'payment-token',
  };

  return vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(paymentResponse), { status: 200 }))
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

describe('LabelsAPI', () => {
  describe('create', () => {
    it('creates a label with both tokens', async () => {
      const mockResult = {
        trackingNumber: '9400111899223033005282',
        postage: 7.75,
        zone: '4',
        commitment: { name: '2-Day' },
      };

      mockBothTokensAndAPI(mockResult);
      const client = makeClient(true);
      const result = await client.labels.create({
        fromAddress: {
          streetAddress: '228 Park Ave S',
          city: 'New York',
          state: 'NY',
          ZIPCode: '10003',
        },
        toAddress: {
          streetAddress: '1600 Pennsylvania Ave NW',
          city: 'Washington',
          state: 'DC',
          ZIPCode: '20500',
        },
        mailClass: 'PRIORITY_MAIL',
        weight: 2.0,
      });

      expect(result.trackingNumber).toBe('9400111899223033005282');
      expect(result.postage).toBe(7.75);

      // Verify the label API call includes payment token header
      const labelCall = vi.mocked(fetch).mock.calls[2];
      const headers = (labelCall[1] as RequestInit).headers as Record<string, string>;
      expect(headers['X-Payment-Authorization-Token']).toBe('payment-token');
    });

    it('throws AuthError without payment credentials', async () => {
      const oauthResponse = {
        access_token: 'oauth-token',
        token_type: 'Bearer',
        expires_in: 28800,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }));

      const client = makeClient(false); // No payment creds
      await expect(
        client.labels.create({
          fromAddress: { streetAddress: '123 Main St', city: 'NY', state: 'NY', ZIPCode: '10001' },
          toAddress: { streetAddress: '456 Oak Ave', city: 'LA', state: 'CA', ZIPCode: '90001' },
          mailClass: 'PRIORITY_MAIL',
          weight: 1.0,
        }),
      ).rejects.toThrow(AuthError);
    });

    it('throws ValidationError for missing fromAddress', async () => {
      const client = makeClient(true);
      await expect(
        client.labels.create({
          fromAddress: { streetAddress: '', city: '', state: '', ZIPCode: '' },
          toAddress: { streetAddress: '456 Oak', city: 'LA', state: 'CA', ZIPCode: '90001' },
          mailClass: 'PRIORITY_MAIL',
          weight: 1.0,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for zero weight', async () => {
      const client = makeClient(true);
      await expect(
        client.labels.create({
          fromAddress: { streetAddress: '123 Main', city: 'NY', state: 'NY', ZIPCode: '10001' },
          toAddress: { streetAddress: '456 Oak', city: 'LA', state: 'CA', ZIPCode: '90001' },
          mailClass: 'PRIORITY_MAIL',
          weight: 0,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('includes idempotency key header when provided', async () => {
      mockBothTokensAndAPI({ trackingNumber: 'test' });
      const client = makeClient(true);

      await client.labels.create({
        fromAddress: { streetAddress: '123 Main', city: 'NY', state: 'NY', ZIPCode: '10001' },
        toAddress: { streetAddress: '456 Oak', city: 'LA', state: 'CA', ZIPCode: '90001' },
        mailClass: 'PRIORITY_MAIL',
        weight: 1.0,
        idempotencyKey: 'unique-key-123',
      });

      const labelCall = vi.mocked(fetch).mock.calls[2];
      const headers = (labelCall[1] as RequestInit).headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('unique-key-123');
    });
  });

  describe('void', () => {
    it('voids a label by tracking number', async () => {
      const oauthResponse = {
        access_token: 'oauth-token',
        token_type: 'Bearer',
        expires_in: 28800,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify(oauthResponse), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'voided' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const client = makeClient();
      const result = await client.labels.void('9400111899223033005282');
      expect(result.status).toBe('voided');

      const apiCall = vi.mocked(fetch).mock.calls[1];
      expect(apiCall[0]).toContain('/labels/v3/label/9400111899223033005282');
      expect((apiCall[1] as RequestInit).method).toBe('DELETE');
    });

    it('throws ValidationError for empty tracking number', async () => {
      const client = makeClient();
      await expect(client.labels.void('')).rejects.toThrow(ValidationError);
    });
  });
});
