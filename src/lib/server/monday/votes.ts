import type { Member, Vote, VoteType } from '$lib/types/domain';
import { MondayClient } from './client';

export const ACTIVITY_BOARD_ID = '18408298018';
export const VOTE_LOG_BOARD_ID = '18411164142';
export const OBJECTION_RESPONSE = "Don't Approve(With Comment)";

const ACTIVITY_COLUMNS = {
	type: 'single_selectis1ajb9',
	submitDate: 'date_mm2mqnq2',
	details: 'long_text3mhw34i5'
};
const LOG_COLUMNS = {
	response: 'color_mm4vbrwr',
	comment: 'long_texta8lzlxn7',
	question: 'text_mm4vp4ny',
	memberId: 'text_mm4vff42',
	voteId: 'text_mm4ve8bt'
};
const VOTE_TYPES = new Set<VoteType>([
	'Super Majority Vote',
	'Consent Vote',
	'Simple Majority Vote'
]);

type Column = { id: string; text: string | null; value: string | null };
type Item = { id: string; name: string; column_values: Column[] };
type Page = { cursor: string | null; items: Item[] };

const INITIAL = `
	query VoteBoard($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items { id name column_values(ids: $columnIds) { id text value } }
			}
		}
	}
`;
const NEXT = `
	query VoteBoardNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items { id name column_values(ids: $columnIds) { id text value } }
		}
	}
`;
const CREATE = `
	mutation RecordVote($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
		create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
			id
		}
	}
`;

function map(item: Item): Map<string, Column> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}
function text(columns: Map<string, Column>, id: string): string {
	return columns.get(id)?.text?.trim() ?? '';
}
function normalizedQuestion(value: string): string {
	return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

export function consentDeadline(submittedAt: string): string {
	const submitted = new Date(`${submittedAt}T12:00:00Z`);
	submitted.setUTCDate(submitted.getUTCDate() + 48);
	return submitted.toISOString().slice(0, 10);
}

export function mapMotion(item: Item): Vote | null {
	const columns = map(item);
	const type = text(columns, ACTIVITY_COLUMNS.type) as VoteType;
	if (!VOTE_TYPES.has(type)) return null;
	const submittedAt = text(columns, ACTIVITY_COLUMNS.submitDate);
	return {
		id: item.id,
		type,
		question: item.name,
		details: text(columns, ACTIVITY_COLUMNS.details),
		submittedAt,
		deadline: type === 'Consent Vote' && submittedAt ? consentDeadline(submittedAt) : ''
	};
}

export type VoteLogEntry = {
	id: string;
	voterLabel: string;
	memberId: string;
	voteId: string;
	question: string;
	response: string;
	comment: string;
};

export function mapVoteLog(item: Item): VoteLogEntry {
	const columns = map(item);
	return {
		id: item.id,
		voterLabel: item.name.trim(),
		memberId: text(columns, LOG_COLUMNS.memberId),
		voteId: text(columns, LOG_COLUMNS.voteId),
		question: text(columns, LOG_COLUMNS.question),
		response: text(columns, LOG_COLUMNS.response),
		comment: text(columns, LOG_COLUMNS.comment)
	};
}

export function voteLogsForMotion(logs: VoteLogEntry[], vote: Vote): VoteLogEntry[] {
	return logs.filter((entry) =>
		entry.voteId
			? entry.voteId === vote.id
			: normalizedQuestion(entry.question) === normalizedQuestion(vote.question)
	);
}

export function voteLogForMember(
	logs: VoteLogEntry[],
	memberId: string,
	vote: Vote
): VoteLogEntry | undefined {
	return voteLogsForMotion(logs, vote).find((entry) => entry.memberId === memberId);
}

export function hasDuplicateVote(logs: VoteLogEntry[], memberId: string, vote: Vote): boolean {
	return voteLogForMember(logs, memberId, vote) !== undefined;
}

function voterName(member: Member): string {
	const parts = member.preferredName.trim().split(/\s+/u);
	const first = parts[0] || 'Member';
	const initial = parts.length > 1 ? `${parts.at(-1)?.charAt(0).toUpperCase()}.` : '';
	return `${first} ${initial} | Member ID: ${member.id}`.replace(/\s+/gu, ' ').trim();
}

export class VoteDirectory {
	constructor(private readonly monday: MondayClient) {}

	private async listBoard(boardId: string, columnIds: string[]): Promise<Item[]> {
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
		return items;
	}

	async listMotions(): Promise<Vote[]> {
		const items = await this.listBoard(ACTIVITY_BOARD_ID, Object.values(ACTIVITY_COLUMNS));
		return items.map(mapMotion).filter((vote): vote is Vote => vote !== null);
	}

	async listVoteLog(): Promise<VoteLogEntry[]> {
		const items = await this.listBoard(VOTE_LOG_BOARD_ID, Object.values(LOG_COLUMNS));
		return items.map(mapVoteLog);
	}

	async recordVote(member: Member, vote: Vote, response: string, comment: string): Promise<string> {
		const result = await this.monday.request<{ create_item: { id: string } }>(CREATE, {
			boardId: VOTE_LOG_BOARD_ID,
			itemName: voterName(member),
			columnValues: JSON.stringify({
				[LOG_COLUMNS.response]: { label: response },
				[LOG_COLUMNS.comment]: comment,
				[LOG_COLUMNS.question]: vote.question,
				[LOG_COLUMNS.memberId]: member.id,
				[LOG_COLUMNS.voteId]: vote.id
			})
		});
		return result.create_item.id;
	}
}
