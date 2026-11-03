export type DriveDocumentVisibility = 'member' | 'colab' | 'admin';

export type DriveDocument = {
	id: string;
	parentId: string;
	rootSectionId: string;
	name: string;
	mimeType: string;
	webViewUrl: string;
	createdAt: string;
	modifiedAt: string;
	byteSize: number;
	isFolder: boolean;
	isShortcut: boolean;
	shortcutTargetId: string;
	visibility: DriveDocumentVisibility;
	syncedAt: string;
};

export type DriveSyncState = {
	status: 'pending' | 'running' | 'complete' | 'failed';
	startedAt: string;
	completedAt: string;
	itemCount: number;
	errorMessage: string;
};
