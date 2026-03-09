# usps-v3

USPS v3 REST API client for Node.js — address validation, tracking, labels, rates, and more.

**Zero dependencies.** Uses built-in `fetch` (Node 18+). Full TypeScript types included.

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

Label creation requires Payment Authorization credentials (CRID, MIDs, EPA).

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

## USPS Developer Portal

1. Register at [developer.usps.com](https://developer.usps.com)
2. Create an application
3. Get your Client ID and Client Secret
4. For labels: complete COP Claims Linking for your CRID/MIDs

## Links

- [Python SDK](https://github.com/revereveal/usps-v3) — same API, Python edition
- [RevAddress API](https://revaddress.com) — managed USPS API with BYOK support
- [USPS v3 API Docs](https://developer.usps.com/api/81)

## License

MIT
