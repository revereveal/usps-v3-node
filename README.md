# usps-v3

[![npm](https://img.shields.io/npm/v/usps-v3)](https://www.npmjs.com/package/usps-v3)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![RevAddress](https://img.shields.io/badge/Managed%20API-RevAddress-6366f1)](https://revaddress.com)

USPS v3 REST API client — OAuth 2.0, address validation, tracking, labels, rates. Drop-in replacement for `usps-webtools` and `usps-webtools-promise` (retired January 2026).

**Zero dependencies.** Uses built-in `fetch` (Node 18+). Full TypeScript types included.

> **Migrating from `usps-webtools` or `usps-webtools-promise`?** Those packages use the retired USPS Web Tools XML API (shut down January 25, 2026). This SDK uses the new v3 REST API with OAuth 2.0. See [Migration from usps-webtools](#migration-from-usps-webtools) below.

> **Don't want to manage USPS credentials?** [RevAddress](https://revaddress.com) provides the managed USPS lane: hosted OAuth, BYOK continuity, and a developer-facing surface without direct USPS auth plumbing. [Get a free sandbox key](https://revaddress.com/signup/) — no credit card required.


## How this family fits together

USPS v3 is one delivery problem with four distinct lanes:

| Need | Best lane |
|---|---|
| Direct Python integration | [`revereveal/usps-v3`](https://github.com/revereveal/usps-v3) |
| Direct Node / TypeScript integration | [`revereveal/usps-v3-node`](https://github.com/revereveal/usps-v3-node) |
| Direct PHP integration | [`revereveal/usps-v3-php`](https://github.com/revereveal/usps-v3-php) |
| Managed OAuth, BYOK orchestration, and hosted developer surface | [RevAddress](https://revaddress.com) |

The three SDK repos are sibling public packages, not duplicates. RevAddress is the managed product lane that sits beside them.

> **Human gate note:** SDK installability and package health are separate from USPS enrollment and entitlement friction for production label/payment flows. The public SDK family can be healthy while USPS operator setup still blocks parts of live production rollout.

## Migrating from EasyPost or USPS Web Tools?

RevAddress provides a managed USPS v3 API with flat monthly pricing — no per-label fees. If you're migrating from EasyPost (shutting down March 17, 2026) or the legacy USPS Web Tools XML API:

- **[Migration Guide](https://revaddress.com/blog/usps-migration-guide/)** — Step-by-step from XML to REST
- **[EasyPost vs RevAddress](https://revaddress.com/blog/easypost-vs-revaddress/)** — Feature and pricing comparison
- **[Endpoint Mapping](https://revaddress.com/blog/usps-web-tools-endpoint-mapping/)** — Every legacy endpoint mapped to v3

Save 81% vs EasyPost at 5,000 labels/mo ($79/mo flat vs $420 in per-label fees). [Get started →](https://revaddress.com/signup/)

## Install

```bash
npm install usps-v3
```

## Quick Start

```typescript
import { USPSClient } from 'usps-v3';

const client = new USPSClient({
  clientId: process.env.USPS_CLIENT_ID,
  clientSecret: process.env.USPS_CLIENT_SECRET,
});

// Validate an address
const result = await client.addresses.validate({
  streetAddress: '1600 Pennsylvania Ave NW',
  city: 'Washington',
  state: 'DC',
  ZIPCode: '20500',
});

console.log(result.address);
// { streetAddress: '1600 PENNSYLVANIA AVE NW', city: 'WASHINGTON', state: 'DC', ZIPCode: '20500' }
```

## API

### Address Validation

```typescript
// Validate and standardize
const validated = await client.addresses.validate({
  streetAddress: '123 Main St',
  city: 'New York',
  state: 'NY',
});

// City/state lookup from ZIP
const info = await client.addresses.cityState('10001');
```

### Package Tracking

```typescript
const tracking = await client.tracking.track('9400111899223033005282');
console.log(tracking.statusCategory); // 'Delivered', 'In Transit', etc.
```

### Rate Shopping

```typescript
// Domestic rates
const rates = await client.prices.domestic({
  originZIPCode: '10001',
  destinationZIPCode: '90210',
  weight: 2.5,
});

// International rates
const intlRates = await client.prices.international({
  originZIPCode: '10001',
  destinationCountryCode: 'GB',
  weight: 3.0,
});
```

### Shipping Labels

Label creation requires Payment Authorization credentials (CRID, MIDs, EPA). See our [USPS CRID/MID enrollment guide](https://revaddress.com/blog/usps-crid-mid-enrollment/) for step-by-step setup.

```typescript
const client = new USPSClient({
  clientId: process.env.USPS_CLIENT_ID,
  clientSecret: process.env.USPS_CLIENT_SECRET,
  crid: process.env.USPS_CRID,
  masterMid: process.env.USPS_MASTER_MID,
  labelMid: process.env.USPS_LABEL_MID,
  epaAccount: process.env.USPS_EPA_ACCOUNT,
});

const label = await client.labels.create({
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

console.log(label.trackingNumber);
```

### Delivery Estimates

```typescript
const estimates = await client.standards.estimates('10001', '90210');
// [{ mailClass: 'PRIORITY_MAIL', daysToDelivery: 2 }, ...]
```

### Drop-off Locations

```typescript
const locations = await client.locations.dropoff({
  destinationZIP: '20500',
  mailClass: 'PRIORITY_MAIL',
});
```

## Configuration

```typescript
const client = new USPSClient({
  clientId: 'your-client-id',       // or USPS_CLIENT_ID env var
  clientSecret: 'your-client-secret', // or USPS_CLIENT_SECRET env var
  baseUrl: 'https://apis.usps.com',  // default
  timeout: 30000,                     // ms, default
  // For label creation:
  crid: '...',         // or USPS_CRID
  masterMid: '...',    // or USPS_MASTER_MID
  labelMid: '...',     // or USPS_LABEL_MID
  epaAccount: '...',   // or USPS_EPA_ACCOUNT
});
```

## Error Handling

```typescript
import { USPSClient, RateLimitError, ValidationError, AuthError } from 'usps-v3';

try {
  await client.addresses.validate({ streetAddress: '' });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log(`Bad field: ${err.field}`);
  } else if (err instanceof RateLimitError) {
    console.log(`Retry after ${err.retryAfter}s`);
  } else if (err instanceof AuthError) {
    console.log('Check credentials');
  }
}
```

| Error Class | When |
|---|---|
| `ValidationError` | Invalid input parameters |
| `AuthError` | OAuth or Payment Auth failure |
| `RateLimitError` | 429 from USPS (default: 60 req/hr) |
| `APIError` | USPS returned an error response |
| `NetworkError` | Connection timeout, DNS failure |

## Token Management

OAuth tokens are cached in memory and auto-refreshed 30 minutes before expiry.

```typescript
// Check token state
console.log(client.tokenStatus);
// { hasOAuthToken: true, oauthExpiresIn: 27000, ... }

// Force refresh
await client.refreshTokens();

// Clean up
client.close();
```

## USPS Rate Limits

The v3 API defaults to **60 requests/hour**. See our [USPS rate limits guide](https://revaddress.com/blog/usps-rate-limits/) for how to request an increase.

## Migration from usps-webtools

The `usps-webtools` and `usps-webtools-promise` npm packages target the **retired** USPS Web Tools XML API (shut down January 25, 2026). If you're using either package, here's how to migrate:

| usps-webtools | usps-v3 |
|---|---|
| `verify(address, callback)` | `client.addresses.validate(address)` |
| `zipCodeLookup(address, callback)` | `client.addresses.cityState(zip)` |
| `track(trackingNumber, callback)` | `client.tracking.track(trackingNumber)` |
| `rates(params, callback)` | `client.prices.domestic(params)` |
| USERID string auth | OAuth 2.0 (Client ID + Secret) |
| XML responses | JSON responses |

**Key differences:**
- OAuth 2.0 instead of USERID — register at [developer.usps.com](https://developer.usps.com)
- Address fields: `Address2` (street) → `streetAddress`, `Address1` (apt) → `secondaryAddress`
- Rate limits: ~60 req/hr default (old API had no practical limit)
- All responses are JSON (no XML parsing needed)

Full migration guide: [USPS Web Tools to v3 REST](https://revaddress.com/blog/usps-migration-guide/) | [Endpoint mapping](https://revaddress.com/blog/usps-web-tools-endpoint-mapping/)

## RevAddress Managed API

If you'd rather not manage USPS OAuth credentials, rate limits, and enrollment yourself, **[RevAddress](https://revaddress.com)** offers a managed REST API:

- **Drop-in USPS v3 API** — same endpoints, managed OAuth
- **Managed OAuth + token lifecycle** — stay out of USPS auth churn
- **Rate-limit smoothing and hosted developer surface** — practical operator path for real workloads
- **BYOK support** — bring your own USPS credentials when you need account continuity
- **Flat monthly pricing** — no per-label fees ([see pricing](https://revaddress.com/pricing/))

[Get a free sandbox key](https://revaddress.com/signup/) — address validation, tracking, and rate shopping included. No credit card required.

## USPS Developer Portal

1. Register at [developer.usps.com](https://developer.usps.com)
2. Create an application
3. Get your Client ID and Client Secret
4. For labels: complete COP Claims Linking for your CRID/MIDs

## Links

- [Python SDK](https://github.com/revereveal/usps-v3) — sibling public SDK for Python
- [PHP SDK](https://github.com/revereveal/usps-v3-php) — sibling public SDK for PHP
- [RevAddress API](https://revaddress.com) — managed USPS API with BYOK support
- [RevAddress Docs](https://revaddress.com/docs/) — API reference and guides
- [RevAddress Pricing](https://revaddress.com/pricing/) — flat monthly, no per-label fees
- [USPS v3 API Docs](https://developer.usps.com/api/81)
- [npm Package](https://www.npmjs.com/package/usps-v3)

## License

MIT

Built by [RevAddress](https://revaddress.com) — direct USPS API integration for developers.
