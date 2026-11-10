import {
	QuickBooksFinanceRepository,
	type FinanceQuickBooksAccount,
	type FinanceQuickBooksSnapshot
} from '$lib/server/db';

const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const INTUIT_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QUICKBOOKS_API_URL = 'https://quickbooks.api.intuit.com/v3/company';
const TOKEN_KEY_BYTES = 32;

export type QuickBooksFinanceEnv = {
	DB: D1Database;
	DASHBOARD_URL: string;
	QBO_CLIENT_ID?: string;
	QBO_CLIENT_SECRET?: string;
	QBO_TOKEN_ENCRYPTION_KEY?: string;
};

type TokenResponse = {
	access_token?: string;
	refresh_token?: string;
};

type QboAccount = {
	Id?: string;
	Name?: string;
	AccountType?: string;
	AccountSubType?: string;
	CurrentBalance?: number | string;
	Active?: boolean;
};

type QboCompanyInfo = {
	CompanyName?: string;
};

type SnapshotAccountInput = Omit<FinanceQuickBooksAccount, 'position'>;

function base64UrlEncode(value: ArrayBuffer | Uint8Array): string {
	const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string): Uint8Array {
	const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
	const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(`${normalized}${padding}`);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

function copyArrayBuffer(value: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(value.byteLength);
	copy.set(value);
	return copy.buffer;
}

async function stateHash(value: string): Promise<string> {
	return base64UrlEncode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function encryptionKey(env: QuickBooksFinanceEnv): Promise<CryptoKey> {
	const value = env.QBO_TOKEN_ENCRYPTION_KEY?.trim() || '';
	if (!value) throw new Error('QuickBooks token encryption is not configured.');
	const bytes = base64UrlDecode(value);
	if (bytes.byteLength !== TOKEN_KEY_BYTES) {
		throw new Error('QuickBooks token encryption key must contain 32 bytes.');
	}
	return crypto.subtle.importKey('raw', copyArrayBuffer(bytes), { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
}

async function encryptRefreshToken(value: string, env: QuickBooksFinanceEnv): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: copyArrayBuffer(iv) },
		await encryptionKey(env),
		copyArrayBuffer(new TextEncoder().encode(value))
	);
	return `${base64UrlEncode(iv)}.${base64UrlEncode(cipher)}`;
}

async function decryptRefreshToken(value: string, env: QuickBooksFinanceEnv): Promise<string> {
	const [ivValue, cipherValue, extra] = value.split('.');
	if (!ivValue || !cipherValue || extra)
		throw new Error('Stored QuickBooks credentials are invalid.');
	try {
		const clear = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: copyArrayBuffer(base64UrlDecode(ivValue)) },
			await encryptionKey(env),
			copyArrayBuffer(base64UrlDecode(cipherValue))
		);
		return new TextDecoder().decode(clear);
	} catch {
		throw new Error('Stored QuickBooks credentials could not be decrypted.');
	}
}

function requiredConfig(env: QuickBooksFinanceEnv): {
	clientId: string;
	clientSecret: string;
} {
	const clientId = env.QBO_CLIENT_ID?.trim() || '';
	const clientSecret = env.QBO_CLIENT_SECRET?.trim() || '';
	if (!clientId || !clientSecret || !env.QBO_TOKEN_ENCRYPTION_KEY?.trim()) {
		throw new Error('QuickBooks OAuth is not configured.');
	}
	return { clientId, clientSecret };
}

export function quickBooksOAuthConfigured(env: QuickBooksFinanceEnv): boolean {
	return Boolean(
		env.QBO_CLIENT_ID?.trim() &&
		env.QBO_CLIENT_SECRET?.trim() &&
		env.QBO_TOKEN_ENCRYPTION_KEY?.trim()
	);
}

export function quickBooksRedirectUri(env: QuickBooksFinanceEnv): string {
	return new URL('/api/admin/finance/quickbooks/callback', env.DASHBOARD_URL).toString();
}

export async function createQuickBooksAuthorizationUrl(
	env: QuickBooksFinanceEnv,
	memberId: string
): Promise<string> {
	const { clientId } = requiredConfig(env);
	const state = crypto.randomUUID();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
	await new QuickBooksFinanceRepository(env.DB).createOAuthState(
		await stateHash(state),
		memberId,
		expiresAt,
		now.toISOString()
	);
	const url = new URL(INTUIT_AUTHORIZE_URL);
	url.search = new URLSearchParams({
		client_id: clientId,
		response_type: 'code',
		scope: 'com.intuit.quickbooks.accounting',
		redirect_uri: quickBooksRedirectUri(env),
		state
	}).toString();
	return url.toString();
}

export async function consumeQuickBooksAuthorizationState(
	env: QuickBooksFinanceEnv,
	state: string
): Promise<string | null> {
	return new QuickBooksFinanceRepository(env.DB).consumeOAuthState(
		await stateHash(state),
		new Date().toISOString()
	);
}

async function tokenRequest(
	env: QuickBooksFinanceEnv,
	parameters: URLSearchParams
): Promise<{ accessToken: string; refreshToken: string }> {
	const { clientId, clientSecret } = requiredConfig(env);
	const response = await fetch(INTUIT_TOKEN_URL, {
		method: 'POST',
		headers: {
			authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			accept: 'application/json',
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: parameters
	});
	if (!response.ok) throw new Error(`QuickBooks authorization failed (${response.status}).`);
	const payload = (await response.json()) as TokenResponse;
	if (!payload.access_token || !payload.refresh_token) {
		throw new Error('QuickBooks authorization returned incomplete credentials.');
	}
	return { accessToken: payload.access_token, refreshToken: payload.refresh_token };
}

async function refreshAccessToken(
	env: QuickBooksFinanceEnv,
	refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
	return tokenRequest(
		env,
		new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
	);
}

async function exchangeAuthorizationCode(
	env: QuickBooksFinanceEnv,
	code: string
): Promise<{ accessToken: string; refreshToken: string }> {
	return tokenRequest(
		env,
		new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: quickBooksRedirectUri(env)
		})
	);
}

async function quickBooksRequest<T>(
	realmId: string,
	accessToken: string,
	path: string
): Promise<T> {
	const response = await fetch(`${QUICKBOOKS_API_URL}/${encodeURIComponent(realmId)}${path}`, {
		headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' }
	});
	if (!response.ok) throw new Error(`QuickBooks data request failed (${response.status}).`);
	return (await response.json()) as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function records(value: unknown): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		const record = asRecord(entry);
		return record ? [record] : [];
	});
}

function money(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	if (typeof value !== 'string') return 0;
	const cleaned = value.replaceAll(/[$,\s]/gu, '');
	if (/^\(.+\)$/u.test(cleaned)) return -Number(cleaned.slice(1, -1)) || 0;
	return Number(cleaned) || 0;
}

function reportLine(row: Record<string, unknown>): { label: string; amount: number } {
	const summary = asRecord(row.Summary);
	const header = asRecord(row.Header);
	const cells = records(summary?.ColData ?? row.ColData ?? header?.ColData);
	const values = cells.map((cell) => (typeof cell.value === 'string' ? cell.value.trim() : ''));
	return { label: values[0] || '', amount: money(values.at(-1)) };
}

function reportValue(report: unknown, labels: string[]): number {
	const targets = labels.map((label) => label.toLowerCase());
	const visit = (node: unknown): number | null => {
		const record = asRecord(node);
		if (!record) return null;
		const line = reportLine(record);
		if (line.label) {
			const label = line.label.toLowerCase();
			if (targets.some((target) => label === target || label.startsWith(target)))
				return line.amount;
		}
		const rows = asRecord(record.Rows);
		for (const child of records(rows?.Row)) {
			const result = visit(child);
			if (result !== null) return result;
		}
		return null;
	};
	return visit(report) ?? 0;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function monthStart(date: string): string {
	return `${date.slice(0, 7)}-01`;
}

function displayAccountOrder(account: SnapshotAccountInput): number {
	const name = account.name.toLowerCase();
	if (name.includes('st m') && name.includes('checking')) return 0;
	if (name.includes('visa') || name.includes('credit')) return 1;
	if (name.includes('paypal')) return 2;
	if (name.includes('venmo')) return 3;
	return 10;
}

function accountSnapshot(payload: unknown): SnapshotAccountInput[] {
	const root = asRecord(payload);
	const query = asRecord(root?.QueryResponse);
	return records(query?.Account)
		.filter((account) => account.Active !== false)
		.map((account) => ({
			qboAccountId: typeof account.Id === 'string' ? account.Id : '',
			name: typeof account.Name === 'string' ? account.Name : 'Unnamed account',
			accountType: typeof account.AccountType === 'string' ? account.AccountType : '',
			accountSubType: typeof account.AccountSubType === 'string' ? account.AccountSubType : '',
			currentBalance: money(account.CurrentBalance)
		}))
		.filter(
			(account) =>
				Boolean(account.qboAccountId) &&
				(account.accountType === 'Bank' || account.accountType === 'Credit Card')
		)
		.sort((left, right) => {
			const order = displayAccountOrder(left) - displayAccountOrder(right);
			return order || left.name.localeCompare(right.name);
		});
}

export async function completeQuickBooksAuthorization(
	env: QuickBooksFinanceEnv,
	input: { code: string; realmId: string; memberId: string }
): Promise<void> {
	const tokens = await exchangeAuthorizationCode(env, input.code);
	const company = await quickBooksRequest<{ CompanyInfo?: QboCompanyInfo }>(
		input.realmId,
		tokens.accessToken,
		`/companyinfo/${encodeURIComponent(input.realmId)}`
	);
	const now = new Date().toISOString();
	await new QuickBooksFinanceRepository(env.DB).saveConnection({
		realmId: input.realmId,
		companyName: company.CompanyInfo?.CompanyName?.trim() || 'QuickBooks company',
		encryptedRefreshToken: await encryptRefreshToken(tokens.refreshToken, env),
		connectedBy: input.memberId,
		now
	});
	try {
		await syncQuickBooksFinanceSnapshot(env);
	} catch (cause) {
		console.error(
			JSON.stringify({
				event: 'quickbooks_initial_finance_sync_failed',
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
	}
}

export async function syncQuickBooksFinanceSnapshot(
	env: QuickBooksFinanceEnv
): Promise<FinanceQuickBooksSnapshot> {
	const repository = new QuickBooksFinanceRepository(env.DB);
	const connection = await repository.connection();
	if (!connection) throw new Error('Connect QuickBooks before refreshing the account snapshot.');
	const now = new Date().toISOString();
	try {
		const tokens = await refreshAccessToken(
			env,
			await decryptRefreshToken(connection.encryptedRefreshToken, env)
		);
		await repository.updateRefreshToken(await encryptRefreshToken(tokens.refreshToken, env), now);
		const asOfDate = today();
		const periodStartDate = monthStart(asOfDate);
		const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
		const [accountsResult, balanceSheet, profitAndLoss] = await Promise.all([
			quickBooksRequest<Record<string, unknown>>(
				connection.realmId,
				tokens.accessToken,
				`/query?query=${query}`
			),
			quickBooksRequest<Record<string, unknown>>(
				connection.realmId,
				tokens.accessToken,
				`/reports/BalanceSheet?start_date=${asOfDate}&end_date=${asOfDate}&accounting_method=Accrual`
			),
			quickBooksRequest<Record<string, unknown>>(
				connection.realmId,
				tokens.accessToken,
				`/reports/ProfitAndLoss?start_date=${periodStartDate}&end_date=${asOfDate}&accounting_method=Accrual`
			)
		]);
		const accounts = accountSnapshot(accountsResult);
		return repository.saveSnapshot({
			asOfDate,
			periodStartDate,
			accountingMethod: 'accrual',
			cashTotal: accounts
				.filter((account) => account.accountType === 'Bank')
				.reduce((sum, account) => sum + account.currentBalance, 0),
			accountsReceivable: reportValue(balanceSheet, [
				'Accounts Receivable (A/R)',
				'Accounts Receivable'
			]),
			accountsPayable: reportValue(balanceSheet, ['Accounts Payable (A/P)', 'Accounts Payable']),
			totalAssets: reportValue(balanceSheet, ['Total Assets', 'Assets']),
			totalLiabilities: reportValue(balanceSheet, ['Total Liabilities', 'Liabilities']),
			totalEquity: reportValue(balanceSheet, ['Total Equity', 'Equity']),
			monthIncome: reportValue(profitAndLoss, ['Total Income', 'Income']),
			monthExpenses: reportValue(profitAndLoss, ['Total Expenses', 'Expenses']),
			monthNetIncome: reportValue(profitAndLoss, ['Net Income']),
			sourceUpdatedAt: now,
			accounts
		});
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'QuickBooks sync failed.';
		await repository.recordSyncFailure(message, now);
		throw cause;
	}
}

export async function syncQuickBooksFinanceSnapshotIfDue(
	env: QuickBooksFinanceEnv,
	minimumAgeMs = 24 * 60 * 60 * 1000
): Promise<{ skipped: boolean; reason: string; snapshot?: FinanceQuickBooksSnapshot }> {
	if (!quickBooksOAuthConfigured(env)) {
		return { skipped: true, reason: 'QuickBooks OAuth is not configured.' };
	}
	const repository = new QuickBooksFinanceRepository(env.DB);
	const connection = await repository.connection();
	if (!connection) return { skipped: true, reason: 'QuickBooks is not connected.' };
	const lastSyncedAt = Date.parse(connection.lastSyncedAt);
	if (
		connection.lastSyncStatus === 'complete' &&
		Number.isFinite(lastSyncedAt) &&
		Date.now() - lastSyncedAt < minimumAgeMs
	) {
		return { skipped: true, reason: 'Snapshot is current.' };
	}
	return {
		skipped: false,
		reason: 'Snapshot refreshed.',
		snapshot: await syncQuickBooksFinanceSnapshot(env)
	};
}
