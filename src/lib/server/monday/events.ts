import type {
	EventAttachment,
	ProjectEventRecord,
	ProjectEventSource,
	ProjectTask
} from '$lib/types/domain';
import { MondayClient } from './client';

export const PROJECT_BOARD_ID = '8390893779';
export const COMMUNITY_BOARD_ID = '8052311890';

const PROJECT_COLUMNS = {
	owner: 'person',
	strategicGoal: 'dropdown_mm0smk1',
	category: 'color_mm0srja3',
	priority: 'color_mm0sh4fe',
	start: 'date_mkns6cak',
	end: 'date_mm171v9p',
	status: 'status',
	location: 'dropdown_mknqezw8',
	posters: 'file_mknscbex',
	files: 'file_mkpbye8s',
	registration: 'link_mkppdhq5',
	survey: 'link_mkpp7m53',
	description: 'text_mm2vbpn3',
	campaignId: 'text_mm5myb9c',
	calendar: 'integration_mm17v8nx',
	spaceReservation: 'color_mm2vwpkb',
	attendees: 'dropdown_mm17a53k'
};

const TASK_COLUMNS = {
	owner: 'person',
	status: 'status',
	dueDate: 'date_mm0yt95b',
	completionDate: 'date0',
	files: 'file_mm196z8c'
} as const;

const COMMUNITY_COLUMNS = {
	poster: 'upload_file_Mjj7BNI5',
	organizer: 'short_text_Mjj7ibQU',
	email: 'email_mkp6jep',
	additionalOrganizers: 'short_text_Mjj7sypL',
	description: 'long_text_Mjj74ax2',
	equipment: 'long_text_Mjj7yY69',
	supportAmount: 'number_Mjj7dbxa',
	supportDetails: 'long_text_mkmt1fs8',
	date: 'date_Mjj7b71V',
	links: 'link_mm345aqv',
	canva: 'link_mkn89n3g',
	additionalInfo: 'long_text_1_Mjj7QGiT',
	space: 'multi_selectgtgkuzvw',
	status: 'status_mkmxzk3x',
	itemId: 'pulse_id_mm2twrhw',
	created: 'pulse_log_mm4wyjyr'
};

const MEMBER_LOCATIONS = ['board room', 'colab', 'community room', 'gym'];

export type ProjectEventUpdate = {
	title: string;
	dateValue: string;
	endDateValue: string;
	status: string;
	location: string;
	description: string;
};

type FileValue = {
	name?: string | null;
	is_image?: boolean | null;
	url?: string | null;
	asset?: {
		public_url?: string | null;
		url_thumbnail?: string | null;
		file_extension?: string | null;
	} | null;
};
type Column = { id: string; text: string | null; value: string | null; files?: FileValue[] };
export type MondayItemUpdate = {
	id: string;
	textBody: string;
	createdAt: string;
	creatorId: string;
	creatorName: string;
};
type RawUpdate = {
	id: string;
	text_body: string | null;
	created_at: string | null;
	creator_id: string | null;
	creator: { name: string | null } | null;
	replies?: RawUpdate[] | null;
};
type Item = {
	id: string;
	name: string;
	created_at?: string | null;
	column_values: Column[];
	updates?: RawUpdate[];
	subitems?: Item[];
};
type Page = { cursor: string | null; items: Item[] };

const INITIAL = `
	query EventBoard($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items {
					id
					name
					created_at
					updates(limit: 100) {
						id text_body created_at creator_id
						creator { name }
						replies { id text_body created_at creator_id creator { name } }
					}
					subitems {
						id name
						updates(limit: 100) {
							id text_body created_at creator_id creator { name }
							replies { id text_body created_at creator_id creator { name } }
						}
						column_values(ids: ["person", "status", "date_mm0yt95b", "date0", "file_mm196z8c"]) {
							id text value
							... on FileValue {
								files {
									... on FileAssetValue {
										name is_image
										asset { public_url url_thumbnail file_extension }
									}
									... on FileLinkValue { name url }
									... on FileDocValue { url }
								}
							}
						}
					}
					column_values(ids: $columnIds) {
						id text value
						... on FileValue {
							files {
								... on FileAssetValue {
									name is_image
									asset { public_url url_thumbnail file_extension }
								}
								... on FileLinkValue { name url }
								... on FileDocValue { url }
							}
						}
					}
				}
			}
		}
	}
`;
const NEXT = `
	query EventBoardNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items {
				id
				name
				created_at
				updates(limit: 100) {
					id text_body created_at creator_id
					creator { name }
					replies { id text_body created_at creator_id creator { name } }
				}
				subitems {
					id name
					updates(limit: 100) {
						id text_body created_at creator_id creator { name }
						replies { id text_body created_at creator_id creator { name } }
					}
					column_values(ids: ["person", "status", "date_mm0yt95b", "date0", "file_mm196z8c"]) {
						id text value
						... on FileValue {
							files {
								... on FileAssetValue {
									name is_image
									asset { public_url url_thumbnail file_extension }
								}
								... on FileLinkValue { name url }
								... on FileDocValue { url }
							}
						}
					}
				}
				column_values(ids: $columnIds) {
					id text value
					... on FileValue {
						files {
							... on FileAssetValue {
								name is_image
								asset { public_url url_thumbnail file_extension }
							}
							... on FileLinkValue { name url }
							... on FileDocValue { url }
						}
					}
				}
			}
		}
	}
`;

const UPDATE_ITEM = `
	mutation UpdateProjectEvent($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
		change_multiple_column_values(
			board_id: $boardId
			item_id: $itemId
			column_values: $columnValues
			create_labels_if_missing: true
		) { id name }
	}
`;

const CREATE_PROJECT = `
	mutation CreateOnboardingProject($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
		create_item(
			board_id: $boardId
			item_name: $itemName
			column_values: $columnValues
			create_labels_if_missing: true
		) { id name }
	}
`;

const CREATE_SUBITEM = `
	mutation CreateProjectTask($parentItemId: ID!, $itemName: String!, $columnValues: JSON!) {
		create_subitem(
			parent_item_id: $parentItemId
			item_name: $itemName
			column_values: $columnValues
			create_labels_if_missing: true
		) { id name }
	}
`;

const CREATE_UPDATE = `
	mutation CreateTaskComment($itemId: ID!, $body: String!) {
		create_update(item_id: $itemId, body: $body) {
			id text_body created_at creator { name }
		}
	}
`;

const TASK_BOARD = `
	query TaskBoard($itemIds: [ID!]!) {
		items(ids: $itemIds) { id board { id } }
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
	const file = column?.files?.[0];
	const fileUrl = file?.asset?.public_url || file?.asset?.url_thumbnail || file?.url;
	if (fileUrl) return fileUrl;
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

function attachments(columns: Map<string, Column>, ...ids: string[]): EventAttachment[] {
	return ids.flatMap((id) =>
		(columns.get(id)?.files ?? [])
			.map((file) => {
				const url = file.asset?.public_url || file.asset?.url_thumbnail || file.url || '';
				const extension = file.asset?.file_extension?.toLocaleLowerCase('en-US') ?? '';
				return {
					name: file.name?.trim() || `Attached ${extension || 'file'}`,
					url,
					isImage:
						file.is_image === true ||
						['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension)
				};
			})
			.filter((file) => file.url)
	);
}

function mondayUrl(boardId: string, itemId: string): string {
	return `https://queerlective.monday.com/boards/${boardId}/pulses/${itemId}`;
}

function mondayUpdates(item: Item): MondayItemUpdate[] {
	return (item.updates ?? [])
		.flatMap((update) => [update, ...(update.replies ?? [])])
		.map((update) => ({
			id: update.id,
			textBody: update.text_body?.trim() ?? '',
			createdAt: update.created_at ?? '',
			creatorId: update.creator_id ?? '',
			creatorName: update.creator?.name?.trim() || 'Monday user'
		}))
		.filter((update) => update.textBody && update.createdAt);
}

function projectTasks(item: Item): ProjectTask[] {
	return (item.subitems ?? []).map((subitem) => {
		const columns = values(subitem);
		const status = text(columns, TASK_COLUMNS.status);
		const completionDate = date(columns, TASK_COLUMNS.completionDate);
		return {
			id: subitem.id,
			title: subitem.name,
			owner: text(columns, TASK_COLUMNS.owner),
			status,
			dueDate: date(columns, TASK_COLUMNS.dueDate),
			completionDate,
			completed: Boolean(completionDate) || /^(?:complete|completed|done)$/iu.test(status),
			attachments: attachments(columns, TASK_COLUMNS.files),
			comments: mondayUpdates(subitem).map((update) => {
				const dashboardAuthor = update.textBody.match(/^\[CoLab member: ([^\]]+)\]\s*/u);
				return {
					id: update.id,
					body: dashboardAuthor
						? update.textBody.slice(dashboardAuthor[0].length)
						: update.textBody,
					author: dashboardAuthor?.[1]?.trim() || update.creatorName,
					createdAt: update.createdAt
				};
			})
		};
	});
}

export function attendeeEmails(value: unknown): string[] {
	if (typeof value !== 'string') return [];
	return [
		...new Set(
			value
				.split(/[,;\n]+/u)
				.map((email) => email.trim().toLocaleLowerCase('en-US'))
				.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
		)
	];
}

export function mapProjectEvent(item: Item, syncedAt: string): ProjectEventRecord {
	const columns = values(item);
	const location = text(columns, PROJECT_COLUMNS.location);
	const files = attachments(columns, PROJECT_COLUMNS.posters, PROJECT_COLUMNS.files);
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
			strategicGoal: text(columns, PROJECT_COLUMNS.strategicGoal),
			category: text(columns, PROJECT_COLUMNS.category),
			priority: text(columns, PROJECT_COLUMNS.priority),
			description: text(columns, PROJECT_COLUMNS.description),
			campaignId: text(columns, PROJECT_COLUMNS.campaignId),
			posterUrl: safeUrl(columns, PROJECT_COLUMNS.posters),
			fileUrl: safeUrl(columns, PROJECT_COLUMNS.files),
			attachments: files,
			registrationUrl: safeUrl(columns, PROJECT_COLUMNS.registration),
			surveyUrl: safeUrl(columns, PROJECT_COLUMNS.survey),
			calendarUrl: safeUrl(columns, PROJECT_COLUMNS.calendar),
			spaceReservation: text(columns, PROJECT_COLUMNS.spaceReservation),
			attendees: text(columns, PROJECT_COLUMNS.attendees),
			tasks: projectTasks(item),
			_mondayUpdates: mondayUpdates(item),
			mondayUrl: mondayUrl(PROJECT_BOARD_ID, item.id)
		},
		syncedAt
	};
}

export function mapCommunityEvent(item: Item, syncedAt: string): ProjectEventRecord {
	const columns = values(item);
	const files = attachments(columns, COMMUNITY_COLUMNS.poster);
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
			additionalOrganizers: text(columns, COMMUNITY_COLUMNS.additionalOrganizers),
			description: text(columns, COMMUNITY_COLUMNS.description),
			link: safeUrl(columns, COMMUNITY_COLUMNS.links),
			posterUrl: safeUrl(columns, COMMUNITY_COLUMNS.poster),
			attachments: files,
			equipmentRequests: text(columns, COMMUNITY_COLUMNS.equipment),
			supportAmount: text(columns, COMMUNITY_COLUMNS.supportAmount),
			supportDetails: text(columns, COMMUNITY_COLUMNS.supportDetails),
			canvaUrl: safeUrl(columns, COMMUNITY_COLUMNS.canva),
			additionalInfo: text(columns, COMMUNITY_COLUMNS.additionalInfo),
			itemId: text(columns, COMMUNITY_COLUMNS.itemId) || item.id,
			creationLog: item.created_at?.trim() || text(columns, COMMUNITY_COLUMNS.created),
			_mondayUpdates: mondayUpdates(item),
			mondayUrl: mondayUrl(COMMUNITY_BOARD_ID, item.id)
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
			try {
				const mapped =
					source === 'project' ? mapProjectEvent(item, '') : mapCommunityEvent(item, '');
				return /^\d{4}-\d{2}-\d{2}$/u.test(mapped.dateValue);
			} catch (cause) {
				console.warn(
					JSON.stringify({
						event: 'event_record_skipped',
						boardId,
						itemId: item.id,
						message: cause instanceof Error ? cause.message : 'Malformed record'
					})
				);
				return false;
			}
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

	async update(
		source: ProjectEventSource,
		itemId: string,
		update: ProjectEventUpdate
	): Promise<void> {
		const boardId = source === 'project' ? PROJECT_BOARD_ID : COMMUNITY_BOARD_ID;
		const columnValues: Record<string, unknown> = {
			name: update.title,
			[source === 'project' ? PROJECT_COLUMNS.start : COMMUNITY_COLUMNS.date]: {
				date: update.dateValue
			},
			[source === 'project' ? PROJECT_COLUMNS.status : COMMUNITY_COLUMNS.status]: update.status,
			[source === 'project' ? PROJECT_COLUMNS.description : COMMUNITY_COLUMNS.description]:
				update.description
		};
		if (source === 'project') {
			columnValues[PROJECT_COLUMNS.end] = update.endDateValue ? { date: update.endDateValue } : {};
			columnValues[PROJECT_COLUMNS.location] = update.location;
		}
		await this.monday.request(UPDATE_ITEM, {
			boardId,
			itemId,
			columnValues: JSON.stringify(columnValues)
		});
	}

	async updateProjectAttendees(itemId: string, emails: string[]): Promise<void> {
		const labels = [
			...new Set(
				emails
					.map((email) => email.trim().toLocaleLowerCase('en-US'))
					.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
			)
		];
		await this.monday.request(UPDATE_ITEM, {
			boardId: PROJECT_BOARD_ID,
			itemId,
			columnValues: JSON.stringify({
				[PROJECT_COLUMNS.attendees]: { labels }
			})
		});
	}

	async createOnboardingProject(input: {
		memberName: string;
		email: string;
		startDate: string;
		endDate: string;
		description: string;
	}): Promise<{ id: string; title: string }> {
		const columnValues: Record<string, unknown> = {
			[PROJECT_COLUMNS.start]: { date: input.startDate },
			[PROJECT_COLUMNS.end]: { date: input.endDate },
			[PROJECT_COLUMNS.location]: { labels: ['CoLab'] },
			[PROJECT_COLUMNS.description]: input.description
		};
		if (input.email) {
			columnValues[PROJECT_COLUMNS.attendees] = {
				labels: [input.email.trim().toLocaleLowerCase('en-US')]
			};
		}
		const result = await this.monday.request<{
			create_item: { id: string; name: string };
		}>(CREATE_PROJECT, {
			boardId: PROJECT_BOARD_ID,
			itemName: `Onboarding: ${input.memberName}`,
			columnValues: JSON.stringify(columnValues)
		});
		return { id: result.create_item.id, title: result.create_item.name };
	}

	async createProjectTask(
		projectId: string,
		input: { title: string; status: string; dueDate: string }
	): Promise<{ id: string; title: string }> {
		const columnValues: Record<string, unknown> = {};
		if (input.status) columnValues[TASK_COLUMNS.status] = { label: input.status };
		if (input.dueDate) columnValues[TASK_COLUMNS.dueDate] = { date: input.dueDate };
		const result = await this.monday.request<{
			create_subitem: { id: string; name: string };
		}>(CREATE_SUBITEM, {
			parentItemId: projectId,
			itemName: input.title,
			columnValues: JSON.stringify(columnValues)
		});
		return { id: result.create_subitem.id, title: result.create_subitem.name };
	}

	async uploadProjectPhoto(projectId: string, file: File) {
		return this.monday.uploadFileToColumn(projectId, PROJECT_COLUMNS.posters, file);
	}

	async completeProjectTask(taskId: string, completionDate: string): Promise<void> {
		const boardResult = await this.monday.request<{
			items: Array<{ id: string; board: { id: string } }>;
		}>(TASK_BOARD, { itemIds: [taskId] });
		const boardId = boardResult.items[0]?.board.id;
		if (!boardId) throw new Error('Monday could not locate the task board.');
		await this.monday.request(UPDATE_ITEM, {
			boardId,
			itemId: taskId,
			columnValues: JSON.stringify({
				[TASK_COLUMNS.status]: { label: 'Done' },
				[TASK_COLUMNS.completionDate]: { date: completionDate }
			})
		});
	}

	async createTaskComment(
		taskId: string,
		body: string
	): Promise<{ id: string; body: string; author: string; createdAt: string }> {
		const result = await this.monday.request<{
			create_update: {
				id: string;
				text_body: string | null;
				created_at: string | null;
				creator: { name: string | null } | null;
			};
		}>(CREATE_UPDATE, { itemId: taskId, body });
		return {
			id: result.create_update.id,
			body: result.create_update.text_body?.trim() || body,
			author: result.create_update.creator?.name?.trim() || 'Monday user',
			createdAt: result.create_update.created_at || new Date().toISOString()
		};
	}
}
