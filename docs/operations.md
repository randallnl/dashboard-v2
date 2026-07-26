# Production operations

This runbook covers deployment, verification, D1 recovery, Worker rollback, and
secret rotation for the CoLab dashboard.

## Pre-deployment checklist

1. Confirm the worktree contains only the intended release.
2. Run:

   ```sh
   npm run validate
   npm run deploy:dry-run
   npm run deploy:cron:dry-run
   ```

3. Check pending production migrations:

   ```sh
   npm run db:migrations:list
   ```

4. Before a production migration, record the current D1 Time Travel bookmark:

   ```sh
   npx wrangler d1 time-travel info queerlective-dashboard
   ```

   Save the bookmark with the release notes. Never put secrets in release notes.

## Required production bindings

The application Worker requires:

- `DB`: `queerlective-dashboard` D1 database.
- `MONDAY_API_TOKEN`: Secrets Store binding.
- `EMAIL`: Cloudflare Email Service binding.
- `LOGIN_FROM_EMAIL`: approved sender address.
- `LOGIN_FROM_NAME`: display name.

The scheduled Worker requires `DB` and `MONDAY_API_TOKEN`. Both Workers have
structured Workers Logs enabled in their Wrangler configuration.

Verify bindings without exposing values:

```sh
curl https://dashboard-v2.randall-d53.workers.dev/api/health
```

## Deployment

Apply migrations before code that depends on them:

```sh
npm run db:migrate:remote
npm run deploy
```

Record the dashboard and cron version IDs emitted by Wrangler. Then verify:

```sh
curl -I 'https://dashboard-v2.randall-d53.workers.dev/?verify=release'
npm run smoke:production
npx wrangler deployments status
npx wrangler deployments status --config wrangler.cron.jsonc
```

The homepage should return `200`. Protected endpoints should return `401` when
called without a session. Responses include `x-request-id`; use that value to
correlate a member report with Workers Logs.

The smoke command is read-only. Follow the
[Phase 11 launch plan](./launch-plan.md) for authenticated pilot testing,
Monday reconciliation, rollout pauses, and general-release approval.

## Monitoring and sync recovery

Workers Logs use structured events and exclude raw tokens, secrets, and member
email addresses. Monitor:

- `request_failed`
- `scheduled_shift_sync_failed`
- `scheduled_shift_sync_completed` with non-zero `shiftFailed` or `eventFailed`
- `shift_upsert_failed`
- `project_event_upsert_failed`
- `shift_signup_failed`
- `vote_submission_failed`

An individual malformed shift or project record no longer aborts the remaining
D1 upserts. Correct the source record in Monday and rerun the relevant protected
admin sync. Monday remains authoritative.

## Worker rollback

List deployments and identify the last known-good version:

```sh
npx wrangler deployments list
npx wrangler deployments list --config wrangler.cron.jsonc
```

Rollback is a production mutation. Confirm the target version and migration
compatibility before running:

```sh
npx wrangler rollback VERSION_ID --message "Rollback: INCIDENT_ID"
npx wrangler rollback VERSION_ID --config wrangler.cron.jsonc --message "Rollback: INCIDENT_ID"
```

Worker rollback does not revert D1. If the old code is incompatible with the
current schema, fix forward or restore D1 separately. Smoke-test immediately
after rollback and record the new active deployment.

## D1 recovery

D1 Time Travel is the primary short-term recovery mechanism. A restore
overwrites the production database and cancels in-flight queries, so it requires
explicit incident approval.

Inspect a point in time:

```sh
npx wrangler d1 time-travel info queerlective-dashboard --timestamp="RFC3339_TIMESTAMP"
```

After confirming the bookmark and impact:

```sh
npx wrangler d1 time-travel restore queerlective-dashboard --bookmark=BOOKMARK
```

Record the pre-restore bookmark printed by Wrangler so the restore can itself be
undone. For longer retention, periodically export D1 to encrypted,
access-controlled storage:

```sh
npx wrangler d1 export queerlective-dashboard --remote --output=dashboard-backup.sql
```

Never commit database exports; they may contain authentication session data.

## Secret rotation

1. Rotate the Monday token in the existing Cloudflare Secrets Store entry.
2. Confirm both Workers still bind `MONDAY_API_TOKEN` to that entry.
3. Deploy both Workers.
4. Verify `/api/health`, authenticated member lookup, and scheduled-sync logs.
5. Revoke the old Monday token only after verification.

For the login sender, update the Email Service binding and `LOGIN_FROM_EMAIL`
together, deploy, request a test magic link, and confirm delivery before removing
the old sender authorization.

Never print, copy into issues, or commit secret values.

## Incident notes

Capture:

- UTC start/end time
- affected Worker version IDs
- commit SHA
- request IDs from failed requests
- D1 bookmark before any migration or restore
- actions taken and smoke-test results

Do not include raw tokens, email addresses, or secret values.
