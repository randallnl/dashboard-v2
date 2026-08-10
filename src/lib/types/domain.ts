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
	canManageProjects: boolean;
	canViewShifts: boolean;
	canViewOpenOrders: boolean;
	canSubmitCommunityEvents: boolean;
	canViewLockboxCode: boolean;
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
	assignedPerson?: string;
	storedPerson?: string;
	coveredBy: string;
	coverageStatus: string;
	isCovered: boolean;
	tags: string[];
	syncedAt: string;
};

export type ShiftSwitchRequest = {
	id: string;
	shiftId: string;
	requesterMemberId: string;
	replacementMemberId: string;
	requestType: 'replacement' | 'release';
	status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
	shiftTitle: string;
	shiftDate: string;
	shiftTime: string;
	requesterLabel: string;
	replacementLabel: string;
	createdAt: string;
	respondedAt: string;
	lastRemindedAt: string;
	direction?: 'incoming' | 'outgoing';
};

export type ProjectEventSource = 'project' | 'community';

export type EventAttachment = {
	name: string;
	url: string;
	isImage: boolean;
};

export type ProjectTask = {
	id: string;
	title: string;
	owner: string;
	status: string;
	dueDate: string;
	completionDate: string;
	completed: boolean;
	attachments: EventAttachment[];
	comments: ProjectTaskComment[];
};

export type ProjectTaskComment = {
	id: string;
	body: string;
	author: string;
	createdAt: string;
};

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

export type UpcomingProjectAssignment = {
	record: ProjectEventRecord;
	roles: Array<'Host' | 'Attendee' | 'Volunteer'>;
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
	linkUrl?: string;
	linkLabel?: string;
	titleUrl?: string;
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

export type GivebutterSignup = {
	id: string;
	donorName: string;
	donorEmail: string;
	campaignId: string;
	eventTitle: string;
	ticketType: string;
	transactionDate: string;
	syncedAt: string;
};

export type EquipmentRequest = {
	id: string;
	title: string;
	requestor: string;
	estimatedCost: string;
	productUrl: string;
	explanation: string;
	additionalInfo: string;
	submittedAt: string;
	syncedAt: string;
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
	isMine: boolean;
	isDeadline: boolean;
	fields: Array<{ label: string; value: string; url: boolean }>;
	imageUrl: string;
	attachments: EventAttachment[];
	pageUrl: string;
};
