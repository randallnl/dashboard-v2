# Phase 11 launch plan

Phase 11 is a controlled operational rollout. Completing this checklist, rather
than deploying code alone, is the release gate for general member access.

## Automated production gate

After every production deployment, run:

```sh
RELEASE_SHA="$(git rev-parse --short HEAD)" npm run smoke:production
```

The gate checks the homepage, configured bindings, unauthenticated authorization,
the custom 404, request IDs, and security headers. It does not send email, create
a session, sign up for a shift, submit a vote, or change Monday data.

## Pilot group

Start with administrators and 3–5 members representing:

- primary and alternate email login;
- members with and without upcoming shifts;
- members with activity, payment, and order history;
- an administrator using “view as member”;
- a member eligible for an open vote.

Record pilot findings in an access-controlled system. Do not put member email
addresses, magic links, tokens, or private Monday data in GitHub issues.

## Reconciliation sample

For each pilot member, compare the portal with Monday for:

| Area     | Compare                                 | Pass condition                      |
| -------- | --------------------------------------- | ----------------------------------- |
| Identity | name, member ID, admin status           | Same member and permissions         |
| Shifts   | dates, coverage, signup result          | No missing or duplicate shifts      |
| Calendar | visible events and admin-only filtering | Dates and visibility match          |
| Votes    | eligibility, deadline, prior submission | Same eligibility; no duplicate vote |
| Activity | totals and recent entries               | Values and dates match              |
| Payments | totals and recent transactions          | Amounts and statuses match          |
| Orders   | item, status, and date                  | No missing or duplicate orders      |

Classify every discrepancy as source-data, normalization, sync freshness, or
application logic. Fix critical and high-severity discrepancies before expanding
the pilot.

## Monitoring window

Run the pilot for at least three normal operating days. Review Workers Logs at
least daily for the events listed in the operations runbook. Pause rollout when:

- a magic-link token or member record is exposed;
- a non-admin can access an admin endpoint;
- a view-as session permits a mutation;
- any duplicate shift signup or vote is accepted;
- two consecutive scheduled syncs fail;
- synchronized records materially disagree with Monday.

One isolated malformed Monday record may be corrected and resynchronized without
pausing the pilot when the remaining records completed successfully.

## Rollout stages

1. Administrators only.
2. Pilot group of 3–5 members.
3. Broader member beta after reconciliation passes.
4. General release after the monitoring window has no open critical or
   high-severity discrepancies.

At each stage, record the commit SHA, Worker version IDs, D1 bookmark, pilot
size, known discrepancies, and go/no-go decision.

## D1-first expansion

Migrate one domain at a time in this order:

1. member profiles;
2. activity records;
3. transactions and orders;
4. votes.

For each domain, add a D1 schema and repository, run Monday and D1 reads in
comparison mode, measure discrepancies, then switch member reads to D1. Keep
Monday authoritative until a full pilot window passes. Do not add admin writes
until the corresponding D1 read model has passed reconciliation.

## General-release sign-off

General release requires:

- the automated production gate passes;
- pilot reconciliation has no open critical or high-severity discrepancies;
- login delivery was verified with the configured sender;
- at least one scheduled sync completed after the current deployment;
- rollback target and D1 bookmark are recorded;
- an administrator explicitly records the go decision.
