# Data ownership and retention

## Source-of-truth boundaries

| Domain                | Source of truth                      | D1 responsibility                                |
| --------------------- | ------------------------------------ | ------------------------------------------------ |
| Members               | Monday CoLab Members board           | None during Phase 1                              |
| Authentication tokens | D1                                   | Authoritative, single-use login tokens           |
| Sessions              | D1                                   | Authoritative, revocable browser sessions        |
| Shifts                | Monday CoLab Calendar board          | Fast read model and immediate post-signup mirror |
| Projects and events   | Monday project and submission boards | Normalized read model                            |
| Votes                 | Monday Vote Log board                | None during Phase 1                              |
| Payments and orders   | Monday Shopify tracker               | None during Phase 1                              |

## Timestamp policy

Application-written timestamps use UTC ISO 8601 strings, such as
`2026-07-24T12:00:00.000Z`. SQLite's `CURRENT_TIMESTAMP` remains the database
default for audit columns. Expiration comparisons always receive an
application-generated UTC ISO timestamp.

## Cleanup policy

`AuthRepository.cleanupExpired(now)` deletes:

- expired or consumed magic-login tokens;
- expired sessions.

Phase 2 should call cleanup opportunistically after successful authentication
requests using the SvelteKit request context's background-work mechanism. A
scheduled Worker cleanup can be added if authentication volume does not provide
enough opportunities. Cleanup is idempotent and does not affect active records.

## Synchronization policy

Shift and project/event upserts are idempotent. Monday remains authoritative, so
a later sync may overwrite the D1 mirror. Workflows that write to Monday must
only update D1 after Monday accepts the mutation.
