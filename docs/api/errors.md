# Errors, Denials and Failure Modes

This is a **behavioral reference** from previously observed route and provider implementations, not a complete exhaustive error enum for current HEAD.

## HTTP response classes

| Status | Observed meaning | Handling |
| --- | --- | --- |
| `400` | Invalid request body, hostname, record type/value, network plan | Correct client input; do not retry unchanged |
| `401` | No valid admin session or access token | Reauthenticate |
| `403` | CSRF/Host/Origin mismatch, missing permissions, provider access denied | Correct trust boundary/permissions; do not disable checks |
| `409` | Invalid state or record changed since it was loaded | Refresh state and re-evaluate; no blind retry |
| `429` | Rate limiting | Back off; avoid rapid repeated retries |
| `502` | Provider unavailable, malformed upstream response or upstream rejection | Check provider/account/network; avoid leaking tokens |
| `503` | First-admin setup required, audit/storage unavailable | Complete first setup or repair private storage |

## Cloudflare provider codes observed

`DnsError` supplied a sanitized `code` and numeric `status`, including codes such as:

`invalid_cloudflare_credentials`, `dns_provider_unreachable`, `dns_provider_bad_response`, `dns_provider_access_denied`, `dns_provider_rate_limited`, `dns_provider_request_failed`, `dns_provider_not_connected`, `invalid_record_name`, `invalid_dns_record`, `invalid_ipv4_address`, `invalid_ipv6_address`, `invalid_dns_target`, `invalid_txt_content`, `mx_priority_required`, `unexpected_mx_priority`, `proxy_not_supported`, `record_type_cannot_change`, `dns_record_changed_refresh_required`, `invalid_record_id`, `dns_record_outside_zone`, and `unsupported_dns_record_type`.

**This list is not a complete exported error enum.** `DnsError` is a code-bearing exception, not a guarantee that every failure at every layer maps to the same HTTP response.

## Error reporting rules

Do not log or return raw Cloudflare API tokens, login passwords, OAuth bearer tokens, session cookies or setup tokens. Audit events previously sanitized actor/detail fields. See [Storage and security](../architecture/storage-and-security.md) and [Debugging](../development/debugging.md).
