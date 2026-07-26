export type AuthenticatedSession = {
	sessionHash: string;
	email: string;
	memberId: string;
	viewedMemberId: string;
	expiresAt: string;
	lastSeenAt: string;
};
