/**
 * Runtime secrets used by the scheduled QuickBooks snapshot refresh. Wrangler only
 * generates bindings it can see in configuration, so secret text bindings are declared here.
 */
interface CronEnv {
	QBO_CLIENT_ID?: string;
	QBO_CLIENT_SECRET?: string;
	QBO_TOKEN_ENCRYPTION_KEY?: string;
}
