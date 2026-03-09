import { describe, it, expect } from 'vitest';
import {
  USPSError,
  AuthError,
  ValidationError,
  RateLimitError,
  APIError,
  NetworkError,
} from '../src/errors.js';

describe('error hierarchy', () => {
  it('USPSError is base class', () => {
    const err = new USPSError('test', 500, { detail: 'info' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('USPSError');
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(500);
    expect(err.responseBody).toEqual({ detail: 'info' });
  });

  it('AuthError extends USPSError', () => {
    const err = new AuthError('unauthorized', 401);
    expect(err).toBeInstanceOf(USPSError);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe('AuthError');
    expect(err.statusCode).toBe(401);
  });

  it('ValidationError includes field', () => {
    const err = new ValidationError('bad zip', 'ZIPCode');
    expect(err).toBeInstanceOf(USPSError);
    expect(err.name).toBe('ValidationError');
    expect(err.field).toBe('ZIPCode');
    expect(err.statusCode).toBe(400);
  });

  it('RateLimitError includes retryAfter', () => {
    const err = new RateLimitError('slow down', 60);
    expect(err).toBeInstanceOf(USPSError);
    expect(err.name).toBe('RateLimitError');
    expect(err.retryAfter).toBe(60);
    expect(err.statusCode).toBe(429);
  });

  it('RateLimitError has sensible defaults', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.retryAfter).toBeUndefined();
  });

  it('APIError preserves response body', () => {
    const body = { error: { code: 'INVALID', message: 'bad input' } };
    const err = new APIError('bad input', 422, body);
    expect(err).toBeInstanceOf(USPSError);
    expect(err.name).toBe('APIError');
    expect(err.responseBody).toBe(body);
  });

  it('NetworkError has no status code', () => {
    const err = new NetworkError('connection refused');
    expect(err).toBeInstanceOf(USPSError);
    expect(err.name).toBe('NetworkError');
    expect(err.statusCode).toBeUndefined();
  });
});
