import { describe, it, expect } from 'vitest';
import { USPSClient } from '../src/client.js';
import { ValidationError } from '../src/errors.js';

describe('USPSClient', () => {
  it('throws ValidationError when no credentials provided', () => {
    // Clear env vars that might be set
    const origId = process.env.USPS_CLIENT_ID;
    const origSecret = process.env.USPS_CLIENT_SECRET;
    delete process.env.USPS_CLIENT_ID;
    delete process.env.USPS_CLIENT_SECRET;

    try {
      expect(() => new USPSClient()).toThrowError(ValidationError);
      expect(() => new USPSClient()).toThrow(/USPS credentials required/);
    } finally {
      if (origId) process.env.USPS_CLIENT_ID = origId;
      if (origSecret) process.env.USPS_CLIENT_SECRET = origSecret;
    }
  });

  it('accepts credentials from config', () => {
    const client = new USPSClient({
      clientId: 'test-id',
      clientSecret: 'test-secret',
    });

    expect(client).toBeDefined();
    expect(client.addresses).toBeDefined();
    expect(client.tracking).toBeDefined();
    expect(client.labels).toBeDefined();
    expect(client.prices).toBeDefined();
    expect(client.standards).toBeDefined();
    expect(client.locations).toBeDefined();
  });

  it('accepts credentials from env vars', () => {
    process.env.USPS_CLIENT_ID = 'env-id';
    process.env.USPS_CLIENT_SECRET = 'env-secret';

    try {
      const client = new USPSClient();
      expect(client).toBeDefined();
    } finally {
      delete process.env.USPS_CLIENT_ID;
      delete process.env.USPS_CLIENT_SECRET;
    }
  });

  it('config overrides env vars', () => {
    process.env.USPS_CLIENT_ID = 'env-id';
    process.env.USPS_CLIENT_SECRET = 'env-secret';

    try {
      // Should not throw — config values take precedence
      const client = new USPSClient({
        clientId: 'config-id',
        clientSecret: 'config-secret',
      });
      expect(client).toBeDefined();
    } finally {
      delete process.env.USPS_CLIENT_ID;
      delete process.env.USPS_CLIENT_SECRET;
    }
  });

  it('tokenStatus returns initial state', () => {
    const client = new USPSClient({
      clientId: 'test-id',
      clientSecret: 'test-secret',
    });

    const status = client.tokenStatus;
    expect(status.hasOAuthToken).toBe(false);
    expect(status.oauthExpiresIn).toBeUndefined();
    expect(status.hasPaymentToken).toBe(false);
    expect(status.paymentExpiresIn).toBeUndefined();
  });

  it('close() does not throw', () => {
    const client = new USPSClient({
      clientId: 'test-id',
      clientSecret: 'test-secret',
    });

    expect(() => client.close()).not.toThrow();
  });
});
