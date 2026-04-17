# API Client (OpenAPI)

Shared API client used by web and mobile. This package exposes:

- `apiFetch` for simple JSON requests
- `createApiClient` for OpenAPI-typed requests

## OpenAPI Workflow

1. Place the OpenAPI spec at `docs/openapi/openapi.yaml`.
2. Run `npm run generate --workspace ./packages/api-client`.
3. Import `createApiClient` and pass a base URL from your app config.

## Example

```ts
import { createApiClient } from "api-client";

const api = createApiClient("https://api.example.com");
```
