# CoLab Dashboard — Phased Implementation Plan

The safest path is to build a thin vertical slice first—authentication through a real member dashboard—then add features one domain at a time. Keep Monday as the source of truth initially while D1 becomes the fast-read and transactional layer.

## Phase 0 — Foundation and decisions

**Goal:** Establish a deployable SvelteKit application with clean boundaries between the UI, Monday, D1, and Cloudflare services.

### Work

- Initialize SvelteKit with TypeScript.
- Configure `@sveltejs/adapter-cloudflare`.
- Add Wrangler configuration for:
  - `DB`
  - `MONDAY_API_TOKEN`
  - `EMAIL`
  - `LOGIN_FROM_EMAIL`
  - `LOGIN_FROM_NAME`
- Establish local and production environment handling.
- Create the initial route and component structure.
- Add shared error handling, logging, and JSON API helpers.
- Implement the Monday token helper supporting both string secrets and Secrets Store bindings.
- Add linting, formatting, type checking, and basic tests.
- Create separate preview and production Cloudflare environments where practical.

### Deliverable

- SvelteKit shell runs locally.
- A minimal Worker deployment succeeds.
- A health endpoint verifies that bindings are present without exposing secrets.

### Exit criteria

- `npm run check` and the production build pass.
- Preview deployment loads successfully.
- Missing bindings produce actionable configuration errors.

## Phase 1 — D1 schema and data-access layer

**Goal:** Establish stable storage primitives before implementing authentication or dashboard behavior.

### Work

- Create migrations for:
  - `magic_login_tokens`
  - `magic_sessions`
  - `colab_shifts`
  - `project_event_records`
- Add indexes for token expiration, session expiration, member IDs, dates, and project source.
- Build typed D1 repository helpers.
- Define normalized TypeScript models for members, shifts, events, votes, payments, and orders.
- Add token hashing and secure random-token utilities.
- Decide how expired tokens and sessions will be removed.
- Document which system is authoritative for each domain.

### Recommended ownership

| Domain | Initial source of truth | D1 role |
|---|---|---|
| Members | Monday | Lookup/cache later |
| Shifts | Monday | Fast reads and immediate signup mirror |
| Projects/events | Monday | Normalized read model |
| Votes | Monday Vote Log | Duplicate-check support later |
| Payments/orders | Monday tracker | Read directly initially |
| Authentication | D1 | Authoritative |
| Sessions | D1 | Authoritative |

### Deliverable

- Repeatable local and remote migrations.
- Tested repository functions for tokens, sessions, shifts, and project records.

### Exit criteria

- Migrations apply cleanly to an empty database.
- Reapplying a deployment does not corrupt data.
- Repository tests cover reads, inserts, expiration, and upserts.

## Phase 2 — Member lookup and magic-link authentication

**Goal:** Deliver a complete login flow before exposing the dashboard shell.

### Work

- Implement a Monday GraphQL client with:
  - Typed request wrapper
  - Pagination
  - Error normalization
  - Timeout handling
  - Safe logging
- Implement member lookup against primary email and Other Emails.
- Normalize emails consistently.
- Build:
  - `POST /api/auth/request`
  - `GET /api/auth/verify`
  - `GET /api/auth/logout`
  - `GET /api/session`
- Store only token hashes and session hashes in D1.
- Make tokens single-use and short-lived.
- Use `HttpOnly`, `Secure`, `SameSite=Lax` session cookies.
- Add rate limiting or request throttling for login attempts.
- Return a neutral response whether an email exists or not.
- Build the logged-out splash screen and authenticated layout guard.
- Do not render the dashboard shell until authentication has resolved.

### Deliverable

- A recognized member can receive a link, authenticate, refresh the page, and log out.
- Unknown addresses do not disclose membership status.

### Exit criteria

- Used and expired links are rejected.
- Expired sessions are rejected.
- Unauthenticated API calls return `401`.
- Cookies have the required security attributes.
- Login behavior works in the deployed Cloudflare environment.

## Phase 3 — Dashboard shell and member identity

**Goal:** Establish the portal navigation, responsive layout, authorization rules, and member context.

### Work

- Build `DashboardShell.svelte`.
- Create server-side layout loading for session and member state.
- Display preferred name, membership type, and basic profile information.
- Add reusable loading, empty, and error states.
- Add responsive navigation for dashboard areas.
- Establish centralized membership capabilities instead of scattering string comparisons across components.
- Implement authorization rules:
  - Members can access only their own data.
  - Admin routes reject non-admins server-side.
  - Retail Only Members receive the required exclusions.
- Add an external resources section.

### Deliverable

- Authenticated members see a complete but initially sparse portal shell.
- Membership-specific visibility is enforced by both the server and UI.

### Exit criteria

- Editing a URL or request parameter cannot expose another member's data.
- Retail Only restrictions apply to both page loads and APIs.
- Admin status is derived from the authoritative member record.

## Phase 4 — Shift synchronization and signup

**Goal:** Complete the first substantial member workflow using Monday and D1 together.

### Work

- Implement Monday subitem pagination for the CoLab Calendar board.
- Normalize shifts into `colab_shifts`.
- Build the admin shift sync endpoint.
- Build `GET /api/shifts`.
- Separate covered shifts from available shifts.
- Derive shift times:
  - Weekdays: 6–8 PM
  - Sundays: 2–4 PM
- Build the full-width available-shifts interface.
- Implement `POST /api/shifts/signup`.
- On signup:
  - Recheck availability.
  - Update all required Monday columns.
  - Upsert D1 immediately.
  - Return the canonical updated shift.
- Protect against two members claiming the same shift.
- Hide shift functionality from Retail Only Members.

### Deliverable

- Admins can sync shifts.
- Members can see open shifts and claim one.
- Claimed shifts appear immediately as covered.

### Exit criteria

- Signup updates Monday and D1 consistently.
- Duplicate or concurrent claims fail safely.
- A failed Monday update does not leave D1 falsely showing success.
- Re-running sync is idempotent.

## Phase 5 — Monthly calendar and event aggregation

**Goal:** Present shifts and events in a single practical calendar.

### Work

- Build a monthly Svelte calendar with:
  - Previous/next month navigation
  - Today indicator
  - Overflow handling
  - Accessible keyboard interaction
- Aggregate:
  - Filled CoLab shifts
  - Project/event records
  - Community-led event submissions
- Apply visibility rules server-side:
  - Admins see all project records.
  - Members see only events in approved CoLab locations.
  - Community-led events appear for all eligible members.
- Show pending versus approved community-event status.
- Make events clickable when details exist.
- Add a compact agenda/list fallback for small screens.

### Deliverable

- Members have a functional monthly calendar backed by real data.

### Exit criteria

- Private internal events never reach non-admin API responses.
- Month boundaries and multi-day events render correctly.
- Retail Only calendar exclusions are applied.

## Phase 6 — Community votes

**Goal:** Deliver secure, duplicate-resistant member voting.

### Work

- Read eligible motions from the Activity/Feedback board.
- Parse vote details from the configured description column.
- Add community-led submissions that qualify for consent voting:
  - Submitted within seven days
  - Requests Queerlective's CoLab Space
- Build:
  - `GET /api/votes`
  - `POST /api/votes`
- Check duplicates using member ID plus Vote ID.
- Fall back to normalized question text only when Vote ID is unavailable.
- Create Vote Log items using the required person and column formats.
- Render vote-type and response pills.
- Require a comment for “Don't Approve (With Comment).”
- Define the 48-day consent-vote calculation clearly and display its deadline.

### Deliverable

- Members see eligible motions and can vote once per question.

### Exit criteria

- Duplicate votes are blocked server-side.
- Vote eligibility is recalculated when submitting.
- A successful response appears immediately in the UI.
- Consent deadlines are timezone-safe and test-covered.

## Phase 7 — Activity, payments, and orders

**Goal:** Complete the member overview and financial-history sections.

### Work

- Build `GET /api/activity`.
- Parse member IDs from the Activity/Feedback Person field.
- Group activity by type and provide a concise summary plus recent log.
- Build `GET /api/payments`.
- Match transactions using normalized member email.
- Include only membership subscription transactions.
- Build `GET /api/orders`.
- Include only unfulfilled, non-subscription orders.
- Add status pills and the Shopify administration link.
- Hide open orders from Retail Only Members.
- Add pagination or sensible record limits.

### Deliverable

- Members see their activity, subscription payment history, and eligible open orders.

### Exit criteria

- Data from one member cannot leak to another.
- Email matching is case-insensitive and normalized.
- Order and payment filters are covered by tests.
- Empty states are understandable and useful.

## Phase 8 — Admin project and event management

**Goal:** Provide administrators with a practical, read-oriented project workspace.

### Work

- Normalize Project/Event Management records.
- Normalize Community Led Event Submission records.
- Sync both sources into `project_event_records`.
- Build:
  - `POST /api/admin/sync/projects`
  - `GET /api/admin/projects`
  - `GET /api/admin/projects/detail`
- Build an admin project list with:
  - Search
  - Source filter
  - Status filter
  - Date filter
  - Category and priority pills
  - Poster thumbnails
- Build source-aware detail routes.
- Include file, registration, survey, calendar, and Monday links where present.
- Implement approved Monday field updates only after read functionality is stable.
- Add clear sync state and last-synced timestamps.

### Deliverable

- Admins can browse and inspect normalized project/event records and run synchronization.

### Exit criteria

- Admin endpoints reject non-admin sessions.
- Sync handles pagination and individual malformed records.
- Filters work without downloading the entire dataset to the browser.
- Detail pages handle missing or expired file assets gracefully.

## Phase 9 — Admin “view as member”

**Goal:** Allow admins to reproduce a member's portal experience safely.

### Work

- Add an admin-only member selector.
- Keep the authenticated admin identity separate from the viewed member.
- Carry impersonation state server-side or in a signed, validated session value.
- Show a persistent “Viewing as…” banner.
- Add an immediate exit action.
- Keep view-as read-only initially.
- Disable shift signup and voting while impersonating.
- If mutations are added later, require explicit confirmation and audit logging.

### Deliverable

- Admins can inspect what a selected member sees without weakening authorization.

### Exit criteria

- Non-admins cannot set or forge viewed-member state.
- The interface always makes impersonation visible.
- Logout clears both session and view-as state.

## Phase 10 — Reliability, accessibility, and production hardening

**Goal:** Make the application safe and dependable enough for regular member use.

### Work

- Add unit tests for normalization and business rules.
- Add integration tests for D1 repositories and authorization.
- Add end-to-end coverage for:
  - Magic-link login
  - Shift signup
  - Voting
  - Admin authorization
  - View-as behavior
- Add structured logs without emails, secrets, or raw tokens.
- Add request IDs and actionable error screens.
- Confirm rate limits and abuse controls.
- Audit keyboard navigation, contrast, focus states, and screen-reader labels.
- Optimize Monday calls and cache appropriate read-only responses.
- Add sync failure visibility and partial-failure recovery.
- Establish backup and migration procedures for D1.
- Document deployment, bindings, secret rotation, and rollback.

### Deliverable

- A tested production candidate with operational documentation.

### Exit criteria

- Critical workflows pass end-to-end in preview.
- Accessibility checks have no critical failures.
- Production secrets and bindings are verified.
- A rollback procedure has been tested.

## Phase 11 — Launch and migration expansion

**Goal:** Launch safely and gradually reduce runtime dependence on Monday.

### Work

- Pilot with administrators and a small member group.
- Compare dashboard results against Monday records.
- Fix discrepancies before general release.
- Schedule recurring synchronization where needed.
- Monitor login delivery, API errors, sync failures, and slow Monday queries.
- Incrementally cache or migrate:
  - Member profiles
  - Activity records
  - Votes
  - Transactions
- Introduce admin write/edit tools only after the read model is trusted.

### Deliverable

- General member launch with a controlled path toward D1-first operation.

## Suggested release milestones

1. **Internal alpha — Phases 0–4:** Authentication, member shell, and shift signup.
2. **Member beta — Phases 5–7:** Calendar, voting, activity, payments, and orders.
3. **Admin beta — Phases 8–9:** Project management and view-as-member.
4. **Production launch — Phases 10–11:** Hardening, pilot, monitoring, and controlled rollout.

## Highest-risk areas

- Monday pagination and inconsistent column values
- Concurrent shift signups
- Duplicate vote prevention
- Email matching across primary and alternate addresses
- Accidentally exposing admin-only events
- Email Service configuration and magic-link deliverability
- Monday/D1 divergence after partial write failures
- File-column URLs that expire or require authentication

These areas should receive integration tests early instead of being deferred to final QA.
