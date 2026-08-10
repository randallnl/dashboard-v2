import {
	CommentRepository,
	GivebutterRepository,
	HostRepository,
	MemberRepository,
	ProjectEventRepository,
	VolunteerRepository
} from '$lib/server/db';
import { attendeeEmails } from '$lib/server/monday/events';
import type { ProjectEventSource } from '$lib/types/domain';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
	const host = await new HostRepository(db).find(record.source, record.id);
	const memberRepository = new MemberRepository(db);
	const [hostMember, members, comments, volunteerMemberIds] = await Promise.all([
		host?.memberId ? memberRepository.findById(host.memberId) : Promise.resolve(null),
		record.source === 'project' ? memberRepository.search('', 100) : Promise.resolve([]),
		new CommentRepository(db).list(record.source, record.id),
		record.source === 'project'
			? new VolunteerRepository(db).listMemberIdsForEvent(record.source, record.id)
			: Promise.resolve(new Set<string>())
	]);
	const memberByEmail = new Map(
		members.flatMap((member) =>
			[member.email, ...member.otherEmails]
				.filter(Boolean)
				.map((email) => [email.trim().toLocaleLowerCase('en-US'), member] as const)
		)
	);
	const attendees = attendeeEmails(record.record.attendees).map((email) => {
		const member = memberByEmail.get(email.toLocaleLowerCase('en-US'));
		return {
			email,
			name: member?.preferredName || email,
			memberId: member?.id || '',
			role:
				member?.id && volunteerMemberIds.has(member.id)
					? ('volunteer' as const)
					: ('attendee' as const)
		};
	});
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
		isAdmin: layout.viewerCapabilities.isAdmin && !layout.isViewingAs,
		canEdit,
		readOnly: layout.isViewingAs
	};
};
