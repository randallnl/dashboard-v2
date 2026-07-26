import type { Activity } from '$lib/types/domain';
import { MondayClient } from './client';

export const ACTIVITY_BOARD_ID = '18408298018';

const COLUMNS = {
	type: 'single_selectis1ajb9',
	submitDate: 'date_mm2mqnq2',
	description: 'long_text3mhw34i5',
	person: 'text_mm34jrzj'
} as const;

type Column = { id: string; text: string | null; value: string | null };
type Item = { id: string; name: string; column_values: Column[] };
type Page = { cursor: string | null; items: Item[] };

const INITIAL = `
	query ActivityBoard($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items { id name column_values(ids: $columnIds) { id text value } }
			}
		}
	}
`;
const NEXT = `
	query ActivityBoardNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items { id name column_values(ids: $columnIds) { id text value } }
		}
	}
`;

function columns(item: Item): Map<string, Column> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}

function text(values: Map<string, Column>, id: string): string {
	return values.get(id)?.text?.trim() ?? '';
}

export function parseActivityMemberId(person: string): string {
	return person.match(/member\s*id\s*:\s*([A-Za-z0-9_-]+)/iu)?.[1] ?? '';
}

export function mapActivity(item: Item): Activity {
	const values = columns(item);
	return {
		id: item.id,
		type: text(values, COLUMNS.type) || 'Activity',
		submitDate: text(values, COLUMNS.submitDate),
		description: text(values, COLUMNS.description) || item.name,
		memberId: parseActivityMemberId(text(values, COLUMNS.person))
	};
}

export function summarizeActivity(activities: Activity[]): Array<{ type: string; count: number }> {
	const counts = new Map<string, number>();
	for (const activity of activities) {
		counts.set(activity.type, (counts.get(activity.type) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([type, count]) => ({ type, count }))
		.sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

export class ActivityDirectory {
	constructor(private readonly monday: MondayClient) {}

	async listForMember(memberId: string, limit = 50): Promise<Activity[]> {
		const initial = await this.monday.request<{ boards: Array<{ items_page: Page }> }>(INITIAL, {
			boardId: ACTIVITY_BOARD_ID,
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
		return items
			.map(mapActivity)
			.filter((activity) => activity.memberId === memberId)
			.sort((left, right) => right.submitDate.localeCompare(left.submitDate))
			.slice(0, limit);
	}
}
