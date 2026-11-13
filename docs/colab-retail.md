# CoLab wholesale retail

CoLab → Retail tracks Faire purchases independently of the general project calendar. Wholesale data and writes are admin-only and unavailable in impersonation mode. Members still have a link to the artist retail portal.

Every order has five reversible checklist steps: receive/check shipment, Shopify inventory, Totally Tea inventory, labels, and Totally Tea display. Completion timestamps and the acting member ID are stored. These steps record manual work; they do not call Shopify or Totally Tea.

## Deployment

1. Apply migration `0039_retail_orders.sql` to the dashboard D1 database before deploying either the app or email worker.
2. Deploy the app and `project-email-ingest` worker using the existing deployment scripts.
3. As an administrator, open CoLab → Retail → Forward Faire emails and generate a private address.
4. In Cloudflare Email Routing for `nhsolidarityecosystem.com`, route the exact generated `retail+TOKEN@nhsolidarityecosystem.com` address to `project-email-ingest`. This does not require changing the existing project addresses. No rule is created by the app.
5. Forward a sample Faire order confirmation and confirm one order with five unchecked steps appears. Forward it again and confirm the existing order and progress remain intact.

## Intake behavior

The private inbox token authorizes email intake. Keep it private. Emails above 5 MB are rejected. Email text is stored (maximum 20,000 characters); attachments are not saved. Treat extracted order numbers as provisional until checked against the original confirmation.

A detected order number deduplicates against both manual and email orders. Existing records and checklist progress are preserved. Without an identifiable order number, the email Message-ID (or raw-message hash) prevents delivery retries from duplicating an order; a separately forwarded message with no order number can still create another record. Send one order confirmation per email. Shipment update emails do not update an existing order's details.

The current first version does not extract product line items, support partial shipments, assign tasks, or edit/delete order metadata. Manual entry requires the Faire order number. Original email text is available under each order for review.
