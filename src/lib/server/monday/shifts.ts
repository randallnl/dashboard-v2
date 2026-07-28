import type { Member, Shift } from '$lib/types/domain';
import { MondayClient } from './client';

export const COLAB_CALENDAR_BOARD_ID = '8374554428';

export const SHIFT_COLUMNS = {
	date: 'date0',
	memberId: 'text_mm35f0vb',
	person: 'text_mm4vxh9t',
	assignedPerson: 'person',
	coverageStatus: 'color_mkw122gj'
} as const;

const COLUMN_IDS = Object.values(SHIFT_COLUMNS);

type MondayColumnValue = { id: string; text: string | null; value: string | null };
type MondayShiftItem = {
	id: string;
	name: string;
	board: { id: string };
	parent_item?: { id: string; name: string } | null;
	column_values: MondayColumnValue[];
};
type MondayParentItem = { id: string; name: string; subitems: MondayShiftItem[] };
type ItemsPage = { cursor: string | null; items: MondayParentItem[] };

const INITIAL_QUERY = `
	query CoLabShiftParents($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 100) {
				cursor
				items {
					id
					name
					subitems {
						id
						name
						board { id }
						parent_item { id name }
						column_values(ids: $columnIds) { id text value }
					}
				}
			}
		}
	}
`;

const NEXT_QUERY = `
	query CoLabShiftParentsNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 100) {
			cursor
			items {
				id
				name
				subitems {
					id
					name
					board { id }
					parent_item { id name }
					column_values(ids: $columnIds) { id text value }
				}
			}
		}
	}
`;

const ITEM_QUERY = `
	query CoLabShift($itemId: ID!, $columnIds: [String!]!) {
		items(ids: [$itemId]) {
			id
			name
			board { id }
			parent_item { id name }
			column_values(ids: $columnIds) { id text value }
		}
	}
`;

const COVER_MUTATION = `
	mutation CoverCoLabShift($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
		change_multiple_column_values(
			board_id: $boardId
			item_id: $itemId
			column_values: $columnValues
		) { id }
	}
`;

function columns(item: MondayShiftItem): Map<string, MondayColumnValue> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}

function text(values: Map<string, MondayColumnValue>, id: string): string {
	return values.get(id)?.text?.trim() ?? '';
}

function dateValue(column: MondayColumnValue | undefined): string {
	if (column?.value) {
		try {
			const value = JSON.parse(column.value) as { date?: unknown };
			if (typeof value.date === 'string') return value.date;
		} catch {
			// Use Monday's rendered value below.
		}
	}
	return column?.text?.trim() ?? '';
}

export function shiftTime(date: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return '';
	return new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? '2pm-4pm' : '6pm-8pm';
}

export function coveredByLabel(value: string): string {
	const name = value.split('|', 1)[0]?.trim() ?? '';
	const parts = name.split(/\s+/u).filter(Boolean);
	if (!parts.length) return 'A member';
	const first = parts[0];
	const last = parts.length > 1 ? parts.at(-1)?.replace(/[^\p{L}]/gu, '') : '';
	return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

export function shiftPersonValue(member: Pick<Member, 'id' | 'preferredName'>): string {
	return `${coveredByLabel(member.preferredName)} | ${member.id}`;
}

export function isShiftCovered(coverageStatus: string, memberId: string, person: string): boolean {
	const status = coverageStatus.trim().toLocaleLowerCase('en-US');
	if (person.trim()) return true;
	if (status === 'open' || status === 'needs coverage') return false;
	return Boolean(memberId || status);
}

export function mapMondayShift(item: MondayShiftItem, syncedAt: string): Shift {
	const values = columns(item);
	const date = dateValue(values.get(SHIFT_COLUMNS.date));
	const memberId = text(values, SHIFT_COLUMNS.memberId);
	const assignedPerson = text(values, SHIFT_COLUMNS.assignedPerson);
	const storedPerson = text(values, SHIFT_COLUMNS.person);
	const person = assignedPerson || storedPerson;
	const coverageStatus = text(values, SHIFT_COLUMNS.coverageStatus) || 'Open';
	const isCovered = isShiftCovered(coverageStatus, memberId, person);

	return {
		id: item.id,
		boardId: item.board.id,
		parentId: item.parent_item?.id ?? '',
		month: item.parent_item?.name ?? '',
		title: item.name,
		dateLabel: values.get(SHIFT_COLUMNS.date)?.text?.trim() ?? date,
		dateValue: date,
		timeLabel: shiftTime(date),
		memberId,
		person,
		assignedPerson,
		storedPerson,
		coveredBy: person,
		coverageStatus,
		isCovered,
		tags: [shiftTime(date) === '2pm-4pm' ? 'sunday' : 'weekday'],
		syncedAt
	};
}

export class ShiftDirectory {
	constructor(private readonly monday: MondayClient) {}

	async list(): Promise<Shift[]> {
		const initial = await this.monday.request<{ boards: Array<{ items_page: ItemsPage }> }>(
			INITIAL_QUERY,
			{ boardId: COLAB_CALENDAR_BOARD_ID, columnIds: COLUMN_IDS }
		);
		const firstPage = initial.boards[0]?.items_page;
		if (!firstPage) return [];

		const parents = [...firstPage.items];
		let cursor = firstPage.cursor;
		while (cursor) {
			const page = await this.monday.request<{ next_items_page: ItemsPage }>(NEXT_QUERY, {
				cursor,
				columnIds: COLUMN_IDS
			});
			parents.push(...page.next_items_page.items);
			cursor = page.next_items_page.cursor;
		}

		const syncedAt = new Date().toISOString();
		return parents.flatMap((parent) =>
			parent.subitems.map((item) =>
				mapMondayShift(
					{ ...item, parent_item: item.parent_item ?? { id: parent.id, name: parent.name } },
					syncedAt
				)
			)
		);
	}

	async findById(itemId: string): Promise<Shift | null> {
		const result = await this.monday.request<{ items: MondayShiftItem[] }>(ITEM_QUERY, {
			itemId,
			columnIds: COLUMN_IDS
		});
		const item = result.items[0];
		return item ? mapMondayShift(item, new Date().toISOString()) : null;
	}

	async cover(
		shift: Pick<Shift, 'id' | 'boardId'>,
		memberId: string,
		person: string
	): Promise<void> {
		await this.monday.request(COVER_MUTATION, {
			boardId: shift.boardId,
			itemId: shift.id,
			columnValues: JSON.stringify({
				[SHIFT_COLUMNS.person]: person,
				[SHIFT_COLUMNS.memberId]: memberId,
				[SHIFT_COLUMNS.coverageStatus]: { label: 'Covered' }
			})
		});
	}

	async release(shift: Pick<Shift, 'id' | 'boardId'>): Promise<void> {
		await this.monday.request(COVER_MUTATION, {
			boardId: shift.boardId,
			itemId: shift.id,
			columnValues: JSON.stringify({
				[SHIFT_COLUMNS.person]: '',
				[SHIFT_COLUMNS.memberId]: '',
				[SHIFT_COLUMNS.coverageStatus]: { label: 'Open' }
			})
		});
	}
}
