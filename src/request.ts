import { APIError, RateLimitError, NetworkError, AuthError } from './errors.js';

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  token: string;
  timeout: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Shared HTTP request helper for USPS v3 API calls.
 * Handles auth headers, JSON serialization, error classification, and rate limits.
 */
export async function uspsRequest<T>(url: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${options.token}`,
    'Accept': 'application/json',
    ...options.headers,
  };

  const init: RequestInit = {
    method: options.method,
    headers,
    signal: AbortSignal.timeout(options.timeout),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  let resp: Response;
  try {
    resp = await fetch(url, init);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('timeout') || msg.includes('abort')) {
      throw new NetworkError(`Request timed out after ${options.timeout}ms`);
    }
    throw new NetworkError(`Network error: ${msg}`);
  }

  if (resp.status === 429) {
    const retryAfter = resp.headers.get('Retry-After');
    throw new RateLimitError(
      'USPS API rate limit exceeded (60 req/hr default). Contact emailus.usps.com for limit increases.',
      retryAfter ? parseInt(retryAfter, 10) : undefined,
    );
  }

  if (resp.status === 401 || resp.status === 403) {
    const text = await resp.text().catch(() => '');
    throw new AuthError(`Authentication failed (${resp.status}): ${text}`, resp.status);
  }

  // Handle multipart responses (label creation returns multipart/form-data)
  const contentType = resp.headers.get('Content-Type') ?? '';
  if (contentType.includes('multipart/')) {
    return parseMultipartLabel(resp) as T;
  }

  if (!resp.ok) {
    let body: unknown;
    try {
      body = await resp.json();
    } catch {
      body = await resp.text().catch(() => '');
    }
    const message = typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).error?.toString() ??
        (body as Record<string, unknown>).message?.toString() ??
        JSON.stringify(body)
      : String(body);
    throw new APIError(message, resp.status, body);
  }

  return resp.json() as Promise<T>;
}

/**
 * Parse USPS multipart label response.
 * USPS returns multipart/form-data with labelMetadata (JSON) + labelImage (PDF binary).
 */
async function parseMultipartLabel(resp: Response): Promise<unknown> {
  const contentType = resp.headers.get('Content-Type') ?? '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);

  if (!boundaryMatch) {
    // Fall back to JSON if no boundary
    return resp.json();
  }

  const text = await resp.text();
  const boundary = boundaryMatch[1].trim();
  const parts = text.split(`--${boundary}`).filter(p => p.trim() && p.trim() !== '--');

  let metadata: Record<string, unknown> = {};

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const partHeaders = part.substring(0, headerEnd).toLowerCase();
    const partBody = part.substring(headerEnd + 4).trimEnd();

    if (partHeaders.includes('labelmetadata') || partHeaders.includes('application/json')) {
      try {
        metadata = JSON.parse(partBody);
      } catch {
        // skip malformed JSON
      }
    }
    // Label image (PDF) is not included in JSON response — would need binary handling
    // For SDK: metadata is sufficient; users download PDF separately if needed
  }

  return metadata;
}
