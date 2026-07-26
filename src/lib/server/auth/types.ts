export type AuthenticatedSession = {
	sessionHash: string;
	email: string;
	memberId: string;
	expiresAt: string;
	lastSeenAt: string;
};
