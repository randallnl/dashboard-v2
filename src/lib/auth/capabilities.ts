import type { Member, MemberCapabilities } from '$lib/types/domain';

function normalizedMembershipType(member: Pick<Member, 'membershipType'>): string {
	return member.membershipType.trim().toLocaleLowerCase('en-US');
}

export function memberCapabilities(member: Pick<Member, 'membershipType'>): MemberCapabilities {
	const membershipType = normalizedMembershipType(member);
	const isAdmin = membershipType === 'admin';
	const isRetailOnly = membershipType === 'retail only member';
	const canViewLockboxCode =
		isAdmin ||
		membershipType.includes('key holder') ||
		membershipType.includes('keyholder') ||
		membershipType.includes('colab member');
	const canManageProjects =
		isAdmin ||
		(!isRetailOnly &&
			(membershipType.includes('key holder') ||
				membershipType.includes('keyholder') ||
				membershipType.includes('colab member') ||
				membershipType.includes('volunteer')));

	return {
		isAdmin,
		isRetailOnly,
		canViewAdminTools: isAdmin,
		canManageProjects,
		canViewShifts: !isRetailOnly,
		canViewOpenOrders: !isRetailOnly,
		canSubmitCommunityEvents: !isRetailOnly,
		canViewLockboxCode,
		canViewCalendar: true,
		canVote: !isRetailOnly
	};
}
