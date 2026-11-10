import {
	CommentRepository,
	GivebutterRepository,
	HostRepository,
	MemberRepository,
	ProjectEventRepository,
	ProjectDriveRepository,
	QuickLinkRepository,
	VolunteerRepository
} from '$lib/server/db';
import { attendeeEmails } from '$lib/server/monday/events';
import type { ProjectEventSource } from '$lib/types/domain';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

async function projectEmailToken(db: D1Database, projectId: string): Promise<string> {
	const existing = await db
		.prepare(`SELECT inbox_token FROM project_email_addresses WHERE project_id = ?1 LIMIT 1`)
		.bind(projectId)
		.first<{ inbox_token: string }>();
	if (existing?.inbox_token) return existing.inbox_token;

	const now = new Date().toISOString();
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await db
			.prepare(
				`INSERT OR IGNORE INTO project_email_addresses (
					project_id, inbox_token, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?3)`
			)
			.bind(projectId, crypto.randomUUID(), now)
			.run();
		const created = await db
			.prepare(`SELECT inbox_token FROM project_email_addresses WHERE project_id = ?1 LIMIT 1`)
			.bind(projectId)
			.first<{ inbox_token: string }>();
		if (created?.inbox_token) return created.inbox_token;
	}
	error(500, 'Could not prepare the project email address.');
}

export const load: PageServerLoad = async ({ params, parent, platform }) => {
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.capabilities || !layout.viewerCapabilities) {
		error(401, 'Authentication required');
	}
	if (params.source !== 'project' && params.source !== 'community') {
		error(404, 'Project or event not found');
	}
	const source = params.source as ProjectEventSource;
	const record = await new ProjectEventRepository(platform!.env.DB).findById(source, params.id);
	const canEdit =
		!layout.isViewingAs &&
		(source === 'project'
			? layout.viewerCapabilities.canManageProjects
			: layout.viewerCapabilities.isAdmin);
	if (
		!record ||
		(record.adminOnly &&
			!layout.viewerCapabilities.isAdmin &&
			!(source === 'project' && layout.viewerCapabilities.canManageProjects))
	) {
		error(404, 'Project or event not found');
	}
	if (layout.capabilities.isRetailOnly && record.source === 'community') {
		error(403, 'This event is not included with this membership.');
	}
	const db = platform!.env.DB;
	const projectEmailInboxToken =
		source === 'project' && canEdit ? await projectEmailToken(db, record.id) : '';
	const quickLinkIncluded =
		source === 'project' && canEdit
			? (await new QuickLinkRepository(db).listProjectIds()).includes(record.id)
			: false;
	const host = await new HostRepository(db).find(record.source, record.id);
	const memberRepository = new MemberRepository(db);
	const driveRepository = new ProjectDriveRepository(db);
	const [
		hostMember,
		members,
		comments,
		participants,
		projectRecords,
		projectDriveFolder,
		projectDriveFiles
	] = await Promise.all([
		host?.memberId ? memberRepository.findById(host.memberId) : Promise.resolve(null),
		memberRepository.search('', 100),
		new CommentRepository(db).list(record.source, record.id),
		new VolunteerRepository(db).listParticipantsForEvent(record.source, record.id),
		source === 'project'
			? new ProjectEventRepository(db).list({ source: 'project', includeAdminOnly: true })
			: Promise.resolve([]),
		source === 'project' ? driveRepository.findFolder(source, record.id) : Promise.resolve(null),
		source === 'project' ? driveRepository.listFiles(source, record.id) : Promise.resolve([])
	]);
	const projectStatusOptions = [
		...new Map(
			projectRecords
				.map((project) => project.status.trim())
				.filter(Boolean)
				.map((status) => [status.toLocaleLowerCase('en-US'), status] as const)
		).values()
	].sort((left, right) => left.localeCompare(right));
	const memberByEmail = new Map(
		members.flatMap((member) =>
			[member.email, ...member.otherEmails]
				.filter(Boolean)
				.map((email) => [email.trim().toLocaleLowerCase('en-US'), member] as const)
		)
	);
	const attendeeByMemberId = new Map(
		attendeeEmails(record.record.attendees).map((email) => {
			const member = memberByEmail.get(email.toLocaleLowerCase('en-US'));
			return [
				member?.id || `email:${email}`,
				{
					email,
					name: member?.preferredName || email,
					memberId: member?.id || '',
					role:
						member?.id && participants.get(member.id) === 'volunteer'
							? ('volunteer' as const)
							: ('attendee' as const)
				}
			] as const;
		})
	);
	for (const [memberId, role] of participants) {
		if (attendeeByMemberId.has(memberId)) continue;
		const member = members.find((candidate) => candidate.id === memberId);
		if (!member?.email) continue;
		attendeeByMemberId.set(memberId, {
			email: member.email,
			name: member.preferredName,
			memberId: member.id,
			role
		});
	}
	const attendees = [...attendeeByMemberId.values()];
	const memberEmails = new Set(
		[layout.member.email, ...layout.member.otherEmails]
			.filter(Boolean)
			.map((email) => email.trim().toLocaleLowerCase('en-US'))
	);
	const hasJoined = attendees.some((attendee) =>
		memberEmails.has(attendee.email.toLocaleLowerCase('en-US'))
	);
	const campaignId =
		typeof record.record.campaignId === 'string' ? record.record.campaignId.trim() : '';
	const signups =
		layout.viewerCapabilities.isAdmin && campaignId
			? await new GivebutterRepository(platform!.env.DB).listByCampaign(campaignId)
			: [];
	const hidden = layout.viewerCapabilities.isAdmin
		? new Set<string>()
		: new Set(['organizerEmail', 'mondayUrl', 'itemId', 'creationLog']);
	return {
		record: {
			...record,
			record: Object.fromEntries(Object.entries(record.record).filter(([key]) => !hidden.has(key)))
		},
		host,
		hostContact: hostMember
			? { email: hostMember.email, phone: hostMember.phone, name: hostMember.preferredName }
			: null,
		attendees,
		hasJoined,
		recentComments: comments.slice(-5).reverse(),
		signups,
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		isAdmin: layout.viewerCapabilities.isAdmin && !layout.isViewingAs,
		canEdit,
		isViewingAs: layout.isViewingAs,
		readOnly: layout.isViewingAs,
		quickLinkIncluded,
		projectStatusOptions,
		projectDriveFolder,
		projectDriveFiles,
		projectEmailForwarding: projectEmailInboxToken
			? {
					address: 'projects@nhsolidarityecosystem.com',
					subjectTag: `[project:${projectEmailInboxToken}]`
				}
			: null
	};
};
