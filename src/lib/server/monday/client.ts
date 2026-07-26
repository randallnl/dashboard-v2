const MONDAY_ENDPOINT = 'https://api.monday.com/v2';
const MONDAY_API_VERSION = '2026-07';
const REQUEST_TIMEOUT_MS = 10_000;

type MondayGraphQLError = {
	message: string;
	extensions?: {
		code?: string;
	};
};

type MondayResponse<T> = {
	data?: T;
	errors?: MondayGraphQLError[];
};

export class MondayApiError extends Error {
	constructor(
		message: string,
		readonly code = 'MONDAY_API_ERROR'
	) {
		super(message);
		this.name = 'MondayApiError';
	}
}

export async function mondayToken(binding: Env['MONDAY_API_TOKEN']): Promise<string> {
	if (typeof binding === 'string') {
		return binding;
	}

	if (binding && typeof binding.get === 'function') {
		return binding.get();
	}

	return '';
}

export class MondayClient {
	constructor(private readonly token: string) {
		if (!token) {
			throw new MondayApiError('Monday API token is not configured', 'MISSING_TOKEN');
		}
	}

	async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
		const response = await fetch(MONDAY_ENDPOINT, {
			method: 'POST',
			headers: {
				Authorization: this.token,
				'Content-Type': 'application/json',
				'API-Version': MONDAY_API_VERSION
			},
			body: JSON.stringify({ query, variables }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});

		if (!response.ok) {
			throw new MondayApiError(`Monday API returned HTTP ${response.status}`, 'HTTP_ERROR');
		}

		const payload = (await response.json()) as MondayResponse<T>;
		const firstError = payload.errors?.[0];
		if (firstError) {
			throw new MondayApiError(firstError.message, firstError.extensions?.code ?? 'GRAPHQL_ERROR');
		}

		if (!payload.data) {
			throw new MondayApiError('Monday API returned no data', 'EMPTY_RESPONSE');
		}

		return payload.data;
	}
}
