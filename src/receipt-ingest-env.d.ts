/**
 * Wrangler generates the platform bindings in receipt-worker-configuration.d.ts.
 * These declarations cover secret text values, which Wrangler intentionally cannot
 * discover from wrangler.jsonc.
 */
interface ReceiptEnv {
	GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: string;
	GOOGLE_DRIVE_RECEIPTS_FOLDER_ID: string;
	NOTIFICATION_EMAIL: string;
	QUICKBOOKS_RECEIPT_EMAIL: string;
	RECEIPT_FROM_EMAIL: string;
	RECEIPT_INBOX_EMAIL: string;
}
