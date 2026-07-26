import { memberCapabilities } from '$lib/auth/capabilities';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import type { Member, MemberCapabilities } from '$lib/types/domain';
import { error } from '@sveltejs/kit';
import type { AuthenticatedSession } from './types';

type MemberContextInput = {
	session: AuthenticatedSession | null;
	env: Env | undefined;
};

export type MemberContext = {
	viewer: Member;
	member: Member;
	capabilities: MemberCapabilities;
	viewerCapabilities: MemberCapabilities;
	isViewingAs: boolean;
};

export function canAccessMember(
	viewerMemberId: string,
	requestedMemberId: string,
	capabilities: Pick<MemberCapabilities, 'isAdmin'>
): boolean {
	return viewerMemberId === requestedMemberId || capabilities.isAdmin;
}

export async function loadMemberContext({
	session,
	env
}: MemberContextInput): Promise<MemberContext> {
	if (!session) {
		error(401, 'Authentication required');
	}
	if (!env) {
		error(503, 'Member service unavailable');
	}

	const token = await mondayToken(env.MONDAY_API_TOKEN);
	const directory = new MemberDirectory(new MondayClient(token));
	const viewer = await directory.findById(session.memberId);
	if (!viewer) {
		error(403, 'Your CoLab membership could not be confirmed.');
	}

	const viewerCapabilities = memberCapabilities(viewer);
	const targetId = session.viewedMemberId.trim() || viewer.id;
	if (!canAccessMember(viewer.id, targetId, viewerCapabilities)) {
		error(403, 'You do not have permission to view another member.');
	}

	const member = targetId === viewer.id ? viewer : await directory.findById(targetId);
	if (!member) {
		error(404, 'Member not found');
	}

	return {
		viewer,
		member,
		capabilities: memberCapabilities(member),
		viewerCapabilities,
		isViewingAs: member.id !== viewer.id
	};
}

export function requireAdmin(context: Pick<MemberContext, 'viewerCapabilities'>): void {
	if (!context.viewerCapabilities.isAdmin) {
		error(403, 'Administrator access required');
	}
}

export function requireWritableMemberView(context: Pick<MemberContext, 'isViewingAs'>): void {
	if (context.isViewingAs) {
		error(403, 'This action is disabled while viewing as another member.');
	}
}
