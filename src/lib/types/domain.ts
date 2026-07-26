export type MembershipType = 'Admin' | 'Retail Only Member' | string;

export type Member = {
	id: string;
	preferredName: string;
	membershipType: MembershipType;
	email: string;
	otherEmails: string[];
	phone: string;
	businessName: string;
	website: string;
	socialMedia: string;
	creativeGroundUrl: string;
	artistDescription: string;
	artistPhotoUrl: string;
	artistBannerUrl: string;
	signUpDate: string;
};

export type MemberCapabilities = {
	isAdmin: boolean;
	isRetailOnly: boolean;
	canViewAdminTools: boolean;
	canViewShifts: boolean;
	canViewOpenOrders: boolean;
	canSubmitCommunityEvents: boolean;
	canViewCalendar: boolean;
	canVote: boolean;
};

export type Shift = {
	id: string;
	boardId: string;
	parentId: string;
	month: string;
	title: string;
	dateLabel: string;
	dateValue: string;
	timeLabel: string;
	memberId: string;
	person: string;
	coveredBy: string;
	coverageStatus: string;
	isCovered: boolean;
	tags: string[];
	syncedAt: string;
};

export type ProjectEventSource = 'project' | 'community';

export type ProjectEventRecord<T extends Record<string, unknown> = Record<string, unknown>> = {
	id: string;
	source: ProjectEventSource;
	title: string;
	dateValue: string;
	endDateValue: string;
	status: string;
	location: string;
	owner: string;
	adminOnly: boolean;
	record: T;
	syncedAt: string;
};

export type ProjectEventComment = {
	id: string;
	source: ProjectEventSource;
	eventId: string;
	authorLabel: string;
	body: string;
	mentionLabels: string[];
	createdAt: string;
};

export type VoteType = 'Super Majority Vote' | 'Consent Vote' | 'Simple Majority Vote';

export type Vote = {
	id: string;
	type: VoteType;
	question: string;
	details: string;
	submittedAt: string;
	deadline: string;
};

export type Activity = {
	id: string;
	type: string;
	submitDate: string;
	description: string;
	memberId: string;
};

export type Payment = {
	id: string;
	name: string;
	amount: number;
	details: string;
	email: string;
	orderDate: string;
};

export type Order = {
	id: string;
	name: string;
	details: string;
	orderDate: string;
	fulfillmentStatus: string;
};

export type CalendarEvent = {
	id: string;
	source: 'shift' | ProjectEventSource;
	title: string;
	startDate: string;
	endDate: string;
	status: string;
	location: string;
	details: string;
	url: string;
	canVolunteer: boolean;
	isVolunteering: boolean;
	fields: Array<{ label: string; value: string; url: boolean }>;
	imageUrl: string;
	pageUrl: string;
};
