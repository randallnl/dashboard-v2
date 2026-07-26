import type { ProjectEventRecord, ProjectEventSource } from '$lib/types/domain';
import { MondayClient } from './client';

export const PROJECT_BOARD_ID = '8390893779';
export const COMMUNITY_BOARD_ID = '8052311890';

const PROJECT_COLUMNS = {
	owner: 'person',
	category: 'color_mm0srja3',
	priority: 'color_mm0sh4fe',
	start: 'date_mkns6cak',
	end: 'date_mm171v9p',
	status: 'status',
	location: 'dropdown_mknqezw8',
	registration: 'link_mkppdhq5',
	description: 'text_mm2vbpn3'
};

const COMMUNITY_COLUMNS = {
	organizer: 'short_text_Mjj7ibQU',
	email: 'email_mkp6jep',
	description: 'long_text_Mjj74ax2',
	date: 'date_Mjj7b71V',
	links: 'link_mm345aqv',
	space: 'multi_selectgtgkuzvw',
	status: 'status_mkmxzk3x'
};

const MEMBER_LOCATIONS = ['board room', 'colab', 'community room', 'gym'];

type Column = { id: string; text: string | null; value: string | null };
type Item = { id: string; name: string; column_values: Column[] };
type Page = { cursor: string | null; items: Item[] };

const INITIAL = `
	query EventBoard($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items { id name column_values(ids: $columnIds) { id text value } }
			}
		}
	}
`;
const NEXT = `
	query EventBoardNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items { id name column_values(ids: $columnIds) { id text value } }
		}
	}
`;

function values(item: Item): Map<string, Column> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}

function text(columns: Map<string, Column>, id: string): string {
	return columns.get(id)?.text?.trim() ?? '';
}

function date(columns: Map<string, Column>, id: string): string {
	const column = columns.get(id);
	if (column?.value) {
		try {
			const parsed = JSON.parse(column.value) as { date?: unknown };
			if (typeof parsed.date === 'string') return parsed.date;
		} catch {
			// Fall back to rendered text.
		}
	}
	return column?.text?.trim() ?? '';
}

function safeUrl(columns: Map<string, Column>, id: string): string {
	const column = columns.get(id);
	if (column?.value) {
		try {
			const parsed = JSON.parse(column.value) as { url?: unknown };
			if (typeof parsed.url === 'string') return parsed.url;
		} catch {
			// Fall back to rendered text.
		}
	}
	return column?.text?.trim() ?? '';
}

export function mapProjectEvent(item: Item, syncedAt: string): ProjectEventRecord {
	const columns = values(item);
	const location = text(columns, PROJECT_COLUMNS.location);
	const visibleToMembers = MEMBER_LOCATIONS.some((allowed) =>
		location.toLocaleLowerCase('en-US').includes(allowed)
	);
	return {
		id: item.id,
		source: 'project',
		title: item.name,
		dateValue: date(columns, PROJECT_COLUMNS.start),
		endDateValue: date(columns, PROJECT_COLUMNS.end),
		status: text(columns, PROJECT_COLUMNS.status),
		location,
		owner: text(columns, PROJECT_COLUMNS.owner),
		adminOnly: !visibleToMembers,
		record: {
			category: text(columns, PROJECT_COLUMNS.category),
			priority: text(columns, PROJECT_COLUMNS.priority),
			description: text(columns, PROJECT_COLUMNS.description),
			registrationUrl: safeUrl(columns, PROJECT_COLUMNS.registration)
		},
		syncedAt
	};
}

export function mapCommunityEvent(item: Item, syncedAt: string): ProjectEventRecord {
	const columns = values(item);
	return {
		id: item.id,
		source: 'community',
		title: item.name,
		dateValue: date(columns, COMMUNITY_COLUMNS.date),
		endDateValue: '',
		status: text(columns, COMMUNITY_COLUMNS.status) || 'Pending',
		location: text(columns, COMMUNITY_COLUMNS.space),
		owner: text(columns, COMMUNITY_COLUMNS.organizer),
		adminOnly: false,
		record: {
			organizerEmail: text(columns, COMMUNITY_COLUMNS.email),
			description: text(columns, COMMUNITY_COLUMNS.description),
			link: safeUrl(columns, COMMUNITY_COLUMNS.links)
		},
		syncedAt
	};
}

export class EventDirectory {
	constructor(private readonly monday: MondayClient) {}

	private async listBoard(
		boardId: string,
		columnIds: string[],
		source: ProjectEventSource
	): Promise<Item[]> {
		const initial = await this.monday.request<{ boards: Array<{ items_page: Page }> }>(INITIAL, {
			boardId,
			columnIds
		});
		const first = initial.boards[0]?.items_page;
		if (!first) return [];
		const items = [...first.items];
		let cursor = first.cursor;
		while (cursor) {
			const page = await this.monday.request<{ next_items_page: Page }>(NEXT, {
				cursor,
				columnIds
			});
			items.push(...page.next_items_page.items);
			cursor = page.next_items_page.cursor;
		}
		return items.filter((item) => {
			const mapped = source === 'project' ? mapProjectEvent(item, '') : mapCommunityEvent(item, '');
			return /^\d{4}-\d{2}-\d{2}$/u.test(mapped.dateValue);
		});
	}

	async list(): Promise<ProjectEventRecord[]> {
		const [projects, community] = await Promise.all([
			this.listBoard(PROJECT_BOARD_ID, Object.values(PROJECT_COLUMNS), 'project'),
			this.listBoard(COMMUNITY_BOARD_ID, Object.values(COMMUNITY_COLUMNS), 'community')
		]);
		const syncedAt = new Date().toISOString();
		return [
			...projects.map((item) => mapProjectEvent(item, syncedAt)),
			...community.map((item) => mapCommunityEvent(item, syncedAt))
		];
	}
}
