import type { EquipmentRequest } from '$lib/types/domain';
import { MondayClient } from './client';

export const EQUIPMENT_REQUEST_BOARD_ID = '8936697922';

const COLUMNS = {
	requestor: 'text_mkq1xed9',
	estimatedCost: 'numeric_mkq1qgzs',
	productUrl: 'link_mkq1xj22',
	explanation: 'long_text_mkq1s3es',
	additionalInfo: 'long_text_mkq11mtr'
} as const;

type Column = { id: string; text: string | null; value: string | null };
type Item = {
	id: string;
	name: string;
	created_at: string | null;
	column_values: Column[];
};
type Page = { cursor: string | null; items: Item[] };

const INITIAL = `
	query EquipmentRequests($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items { id name created_at column_values(ids: $columnIds) { id text value } }
			}
		}
	}
`;

const NEXT = `
	query EquipmentRequestsNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items { id name created_at column_values(ids: $columnIds) { id text value } }
		}
	}
`;

function values(item: Item): Map<string, Column> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}

function text(columns: Map<string, Column>, id: string): string {
	return columns.get(id)?.text?.trim() ?? '';
}

function webUrl(value: string): string {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch {
		return '';
	}
}

function link(columns: Map<string, Column>, id: string): string {
	const column = columns.get(id);
	if (column?.value) {
		try {
			const value = JSON.parse(column.value) as { url?: unknown };
			if (typeof value.url === 'string') return webUrl(value.url.trim());
		} catch {
			// Fall back to Monday's rendered text.
		}
	}
	return webUrl(column?.text?.trim() ?? '');
}

export function mapEquipmentRequest(item: Item, syncedAt: string): EquipmentRequest {
	const columns = values(item);
	return {
		id: item.id,
		title: item.name.trim() || 'Material or equipment request',
		requestor: text(columns, COLUMNS.requestor),
		estimatedCost: text(columns, COLUMNS.estimatedCost),
		productUrl: link(columns, COLUMNS.productUrl),
		explanation: text(columns, COLUMNS.explanation),
		additionalInfo: text(columns, COLUMNS.additionalInfo),
		submittedAt: item.created_at?.trim() || syncedAt,
		syncedAt
	};
}

export class EquipmentRequestDirectory {
	constructor(private readonly monday: MondayClient) {}

	async list(): Promise<EquipmentRequest[]> {
		const initial = await this.monday.request<{ boards: Array<{ items_page: Page }> }>(INITIAL, {
			boardId: EQUIPMENT_REQUEST_BOARD_ID,
			columnIds: Object.values(COLUMNS)
		});
		const first = initial.boards[0]?.items_page;
		if (!first) return [];
		const items = [...first.items];
		let cursor = first.cursor;
		while (cursor) {
			const page = await this.monday.request<{ next_items_page: Page }>(NEXT, {
				cursor,
				columnIds: Object.values(COLUMNS)
			});
			items.push(...page.next_items_page.items);
			cursor = page.next_items_page.cursor;
		}
		const syncedAt = new Date().toISOString();
		return items.map((item) => mapEquipmentRequest(item, syncedAt));
	}
}
