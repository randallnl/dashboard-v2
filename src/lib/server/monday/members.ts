import type { Member } from '$lib/types/domain';
import { MondayClient } from './client';

export const MEMBERS_BOARD_ID = '8402413272';

const MEMBER_COLUMNS = {
	preferredName: 'text_mm35brvq',
	membershipType: 'color_mkw1xfh2',
	email: 'email_mkmvg87g',
	phone: 'phone_mknqvkap',
	businessName: 'text_mkmv5bft',
	website: 'text_mkmv5n45',
	socialMedia: 'text_mkmvj6ks',
	creativeGroundUrl: 'text_mkq03vne',
	artistDescription: 'long_text_mkmv2eh9',
	artistPhoto: 'files_mkmv5d0k',
	artistBanner: 'file_mkqx9xa3',
	signUpDate: 'date_1_mkmvqa90',
	memberId: 'pulse_id_mm34sv67',
	otherEmails: 'text_mm358g6e'
} as const;

const COLUMN_IDS = Object.values(MEMBER_COLUMNS);

type MondayColumnValue = {
	id: string;
	text: string | null;
	value: string | null;
};

type MondayMemberItem = {
	id: string;
	name: string;
	column_values: MondayColumnValue[];
};

type ItemsPage = {
	cursor: string | null;
	items: MondayMemberItem[];
};

type InitialMemberPage = {
	boards: Array<{
		items_page: ItemsPage;
	}>;
};

type NextMemberPage = {
	next_items_page: ItemsPage;
};

const INITIAL_MEMBERS_QUERY = `
	query CoLabMembers($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items {
					id
					name
					column_values(ids: $columnIds) {
						id
						text
						value
					}
				}
			}
		}
	}
`;

const NEXT_MEMBERS_QUERY = `
	query CoLabMembersNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items {
				id
				name
				column_values(ids: $columnIds) {
					id
					text
					value
				}
			}
		}
	}
`;

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

function columnMap(item: MondayMemberItem): Map<string, MondayColumnValue> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}

function columnText(columns: Map<string, MondayColumnValue>, id: string): string {
	return columns.get(id)?.text?.trim() ?? '';
}

function primaryEmail(columns: Map<string, MondayColumnValue>): string {
	const column = columns.get(MEMBER_COLUMNS.email);
	if (!column) return '';

	if (column.value) {
		try {
			const value = JSON.parse(column.value) as { email?: unknown };
			if (typeof value.email === 'string') return normalizeEmail(value.email);
		} catch {
			// Fall back to the rendered text value.
		}
	}

	return normalizeEmail(column.text ?? '');
}

export function parseOtherEmails(value: string): string[] {
	const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [];
	return [...new Set(matches.map(normalizeEmail))];
}

export function mapMondayMember(item: MondayMemberItem): Member {
	const columns = columnMap(item);
	const email = primaryEmail(columns);
	const otherEmails = parseOtherEmails(columnText(columns, MEMBER_COLUMNS.otherEmails)).filter(
		(otherEmail) => otherEmail !== email
	);

	return {
		id: columnText(columns, MEMBER_COLUMNS.memberId) || item.id,
		preferredName: columnText(columns, MEMBER_COLUMNS.preferredName) || item.name,
		membershipType: columnText(columns, MEMBER_COLUMNS.membershipType),
		email,
		otherEmails,
		phone: columnText(columns, MEMBER_COLUMNS.phone),
		businessName: columnText(columns, MEMBER_COLUMNS.businessName),
		website: columnText(columns, MEMBER_COLUMNS.website),
		socialMedia: columnText(columns, MEMBER_COLUMNS.socialMedia),
		creativeGroundUrl: columnText(columns, MEMBER_COLUMNS.creativeGroundUrl),
		artistDescription: columnText(columns, MEMBER_COLUMNS.artistDescription),
		artistPhotoUrl: columnText(columns, MEMBER_COLUMNS.artistPhoto),
		artistBannerUrl: columnText(columns, MEMBER_COLUMNS.artistBanner),
		signUpDate: columnText(columns, MEMBER_COLUMNS.signUpDate)
	};
}

export class MemberDirectory {
	constructor(private readonly monday: MondayClient) {}

	async list(): Promise<Member[]> {
		const initial = await this.monday.request<InitialMemberPage>(INITIAL_MEMBERS_QUERY, {
			boardId: MEMBERS_BOARD_ID,
			columnIds: COLUMN_IDS
		});
		const firstPage = initial.boards[0]?.items_page;
		if (!firstPage) return [];

		const items = [...firstPage.items];
		let cursor = firstPage.cursor;

		while (cursor) {
			const page = await this.monday.request<NextMemberPage>(NEXT_MEMBERS_QUERY, {
				cursor,
				columnIds: COLUMN_IDS
			});
			items.push(...page.next_items_page.items);
			cursor = page.next_items_page.cursor;
		}

		return items.map(mapMondayMember);
	}

	async findByEmail(email: string): Promise<Member | null> {
		const normalized = normalizeEmail(email);
		if (!normalized) return null;

		const members = await this.list();
		return (
			members.find(
				(member) => member.email === normalized || member.otherEmails.includes(normalized)
			) ?? null
		);
	}

	async findById(memberId: string): Promise<Member | null> {
		const members = await this.list();
		return members.find((member) => member.id === memberId) ?? null;
	}
}
