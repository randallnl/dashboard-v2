import type { Member, MemberCapabilities } from '$lib/types/domain';

function normalizedMembershipType(member: Pick<Member, 'membershipType'>): string {
	return member.membershipType.trim().toLocaleLowerCase('en-US');
}

export function memberCapabilities(member: Pick<Member, 'membershipType'>): MemberCapabilities {
	const membershipType = normalizedMembershipType(member);
	const isAdmin = membershipType === 'admin';
	const isRetailOnly = membershipType === 'retail only member';

	return {
		isAdmin,
		isRetailOnly,
		canViewAdminTools: isAdmin,
		canViewShifts: !isRetailOnly,
		canViewOpenOrders: !isRetailOnly,
		canSubmitCommunityEvents: !isRetailOnly,
		canViewCalendar: true,
		canVote: true
	};
}
