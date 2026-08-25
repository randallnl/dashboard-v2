const MONDAY_ENDPOINT = 'https://api.monday.com/v2';
const MONDAY_API_VERSION = '2026-07';
const REQUEST_TIMEOUT_MS = 10_000;
const FILE_UPLOAD_TIMEOUT_MS = 60_000;

export type MondayUploadedAsset = {
	id: string;
	name: string;
	url: string;
	publicUrl: string;
	thumbnailUrl: string;
	fileExtension: string;
};

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

	async uploadFileToColumn(
		itemId: string,
		columnId: string,
		file: File
	): Promise<MondayUploadedAsset> {
		if (!/^\d+$/u.test(itemId) || !/^[a-zA-Z0-9_]+$/u.test(columnId)) {
			throw new MondayApiError('Invalid Monday item or file column', 'INVALID_UPLOAD_TARGET');
		}
		const query = `mutation ($file: File!) {
			add_file_to_column(item_id: ${itemId}, column_id: "${columnId}", file: $file) {
				id name url public_url url_thumbnail file_extension
			}
		}`;
		const body = new FormData();
		body.append('query', query);
		body.append('map', JSON.stringify({ image: 'variables.file' }));
		body.append('image', file, file.name);
		const response = await fetch('https://api.monday.com/v2/file', {
			method: 'POST',
			headers: { Authorization: this.token, 'API-Version': MONDAY_API_VERSION },
			body,
			signal: AbortSignal.timeout(FILE_UPLOAD_TIMEOUT_MS)
		});
		if (!response.ok) {
			throw new MondayApiError(`Monday file upload returned HTTP ${response.status}`, 'HTTP_ERROR');
		}
		const payload = (await response.json()) as MondayResponse<{
			add_file_to_column: {
				id: string;
				name: string;
				url: string;
				public_url: string;
				url_thumbnail: string | null;
				file_extension: string;
			};
		}>;
		const firstError = payload.errors?.[0];
		if (firstError) {
			throw new MondayApiError(firstError.message, firstError.extensions?.code ?? 'GRAPHQL_ERROR');
		}
		const asset = payload.data?.add_file_to_column;
		if (!asset) throw new MondayApiError('Monday returned no uploaded asset', 'EMPTY_RESPONSE');
		return {
			id: asset.id,
			name: asset.name,
			url: asset.url,
			publicUrl: asset.public_url,
			thumbnailUrl: asset.url_thumbnail ?? '',
			fileExtension: asset.file_extension
		};
	}
}
