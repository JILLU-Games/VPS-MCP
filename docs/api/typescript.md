# TypeScript Module and Class Reference — Internal / Non-Stable

**Important:** These are *source-level* symbols, **not public npm package exports**. At `5c19d0a9fff8d63bd55a4447c891f2b26374c32b`, `package.json` has `"private": true` and no `exports`, `main`, or `types` fields. Do not publish or depend on these imports as a stable SDK. Selected signatures below were rechecked against the source on 2026-11-20.

## Configuration

```ts
// src/shared/config.ts
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig;
```

`loadConfig` validated raw environment data with Zod and returned derived fields `origin`, `redirectUris`, `allowedTools`, `secureCookies`, `writesEnabled`, and a boolean `MCP_ALLOW_GIT_SYNC`. Invalid origin/allowlists and unsafe public transport combinations raise validation errors. See [Configuration](../reference/configuration.md).

## HTTP application

```ts
// src/server/http.ts — rechecked 2026-11-20 after Cloudflare integration
export function createHttpServer(
  config: AppConfig = loadConfig(),
  dnsFetch: typeof fetch = fetch
): {
  server: Server;
  oauth: OAuthService;
  shutdown: () => Promise<void>;
};
```

The second parameter was introduced as a *testing dependency-injection seam* for Cloudflare HTTP calls. This is an internal application factory, not a promised stable library entrypoint. Binding/listening is separate from creating the server. Closing the HTTP server and flushing audit state is the responsibility of the returned `shutdown()` helper.

## Network drafts

```ts
// src/security/network.ts
export type NetworkPlan = {
  version: 1;
  domain: string;
  hostPort: number;
  sslMode: 'private-only' | 'external-https';
};

export class NetworkSettings {
  constructor(config: AppConfig);
  snapshot(): unknown; // exact object type not exported in reviewed excerpt
  validate(input: unknown): NetworkPlan;
  save(input: unknown): unknown;
  dnsCheck(): Promise<unknown>;
}
```

The source constructor was in fact written with a TypeScript parameter property (`private readonly config: AppConfig`); the plain constructor above represents the callable signature. `snapshot()` and `save()` expose read-only status/draft objects, not public stable DTO interfaces. `dnsCheck()` resolves A and AAAA for a previously saved draft. None of these methods changes public DNS or installs HTTPS.

## Cloudflare provider

```ts
// src/security/cloudflare-dns.ts
export class DnsError extends Error {
  constructor(code: string, status: number = 400);
}

export class CloudflareDns {
  constructor(config: AppConfig, request: typeof fetch = fetch);
  status(): unknown;
  connect(input: unknown): Promise<unknown>;
  disconnect(): unknown;
  list(): Promise<unknown>;
  create(input: unknown): Promise<unknown>;
  update(id: string, input: unknown, expectedContent: unknown): Promise<unknown>;
  remove(
    id: string,
    confirmName: unknown,
    confirmType: unknown,
    expectedContent: unknown
  ): Promise<unknown>;
}
```

These are the previously reviewed definitions, including the later stale-record rejection arguments. The implementation fixes Cloudflare's API host, checks zone IDs, performs record validation, stores credentials privately, and avoids returning the provider token through `status()`. Exact DTO return types are deliberately **not invented**.

## Audit

`src/security/audit.ts` currently exports `AuditLog` and the `AuditEvent` type. This remains internal and is not a public package API. The reviewed methods were `record`, `list(limit = 30)`, `flush`, `ensureHealthy` and asynchronous `recordDurable`. The observed `recordDurable()` awaited persistence and was used for fail-closed authorization-intent recording.

## Public-vs-internal warning

Do not document `PolicyStore`, `OAuthService`, broker implementation classes, or other private functions as supported SDK imports without inspecting package exports and exact source-level signatures. The project currently offers operational HTTP/MCP integration, **not a verified redistributable library API**.
