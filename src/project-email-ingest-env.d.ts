/** Secret-free bindings for the project inbound-email Worker. */
interface ProjectEmailEnv {
	PROJECT_INBOX_EMAIL: string;
	PROJECT_DRIVE: Fetcher;
	RECEIPT_INBOX_EMAIL: string;
	RETAIL_RECEIPT_FROM_EMAIL: string;
}
