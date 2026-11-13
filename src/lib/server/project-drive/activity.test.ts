import { describe, expect, it } from 'vitest';
import { projectDriveUploadActivity } from './activity';

describe('projectDriveUploadActivity', () => {
	it('creates a durable system comment with links to each uploaded Drive file', () => {
		const activity = projectDriveUploadActivity({
			source: 'project',
			projectId: 'project-1',
			origin: 'email',
			actor: 'sender@example.com',
			files: [
				{ id: 'file-b', name: 'Agenda.pdf', url: 'https://drive.google.com/open?id=file-b' },
				{ id: 'file-a', name: 'Budget.xlsx', url: 'https://drive.google.com/open?id=file-a' }
			],
			now: '2026-11-13T15:00:00.000Z'
		});

		expect(activity).toMatchObject({
			id: 'drive-upload:email:project:project-1:file-a:file-b',
			authorLabel: 'Project Drive',
			memberId: 'system:drive:email'
		});
		expect(activity.body).toContain('saved to the project Drive folder from an email sent by sender@example.com.');
		expect(activity.body).toContain('Agenda.pdf\nhttps://drive.google.com/open?id=file-b');
		expect(activity.body).toContain('Budget.xlsx\nhttps://drive.google.com/open?id=file-a');
	});
});
