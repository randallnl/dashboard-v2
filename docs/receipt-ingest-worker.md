# Receipt ingest Worker

This Worker receives mail sent to a dedicated Cloudflare Email Routing address, stores every ordinary attachment in Google Drive, emails each attachment to the configured QuickBooks receipt address, and emails a completion notice once every step succeeds.

It uses D1 to record an inbound message and each attachment. A retry skips Drive uploads and QuickBooks sends that already succeeded, so a temporary failure does not produce duplicate receipts. The completion notification is also recorded before the receipt is marked complete.

## One-time setup

1. Create or select a dedicated address, such as `receipts@nhciviccommons.com`, in a Cloudflare-managed domain. Enable Email Routing for that domain.
2. Enable Cloudflare Email Sending for `nhciviccommons.com`. The Worker sends as `dashboard@nhciviccommons.com`, which is restricted in [wrangler.receipts.jsonc](../wrangler.receipts.jsonc).
3. Create a Google Drive folder for receipts and share it with the existing Google service account as an **Editor**. Its folder ID is the portion after `/folders/` in its Drive URL.
4. Run the database migration before deploying the Worker:

   ```sh
   npx wrangler d1 migrations apply queerlective-dashboard --remote
   ```

5. Add the following Worker secrets interactively (do not commit their values):

   ```sh
   npx wrangler secret put GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON --config wrangler.receipts.jsonc
   npx wrangler secret put GOOGLE_DRIVE_RECEIPTS_FOLDER_ID --config wrangler.receipts.jsonc
   npx wrangler secret put QUICKBOOKS_RECEIPT_EMAIL --config wrangler.receipts.jsonc
   npx wrangler secret put NOTIFICATION_EMAIL --config wrangler.receipts.jsonc
   npx wrangler secret put RECEIPT_INBOX_EMAIL --config wrangler.receipts.jsonc
   npx wrangler secret put RECEIPT_FROM_EMAIL --config wrangler.receipts.jsonc
   ```

   `RECEIPT_FROM_EMAIL` must be `dashboard@nhciviccommons.com` unless the sender allowlist in the Worker configuration is deliberately changed.

6. Deploy and create an Email Routing rule with the dedicated receipt address as the matcher and the deployed `receipt-ingest` Worker as its action:

   ```sh
   npx wrangler deploy --config wrangler.receipts.jsonc
   ```

## Operational behavior

- Cloudflare validates incoming mail authentication before invoking the Worker. The Worker additionally accepts mail only at `RECEIPT_INBOX_EMAIL`.
- Each non-inline file attachment is uploaded to the Drive folder and sent as a separate email to QuickBooks.
- A completion notification is sent only after all attachments have both a Drive file ID and a QuickBooks message ID.
- A failed run is logged in the `receipt_ingest` table with its last error. Resending the same original email can safely continue incomplete work.
- Cloudflare Email Sending has a 25 MiB total-message limit, so keep individual receipt emails below that threshold.
