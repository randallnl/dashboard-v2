import type { ProjectEventRecord } from '$lib/types/domain';
import { describe, expect, it } from 'vitest';
import { socialDraftFromProject } from './project-draft';

const project = {
	id: '123',
	source: 'project',
	title: 'Open Studio Night',
	dateValue: '2026-11-18',
	endDateValue: '',
	status: 'Scheduled',
	location: 'Queerlective CoLab',
	owner: 'Avery',
	adminOnly: false,
	syncedAt: '2026-10-14T16:00:00Z',
	record: {
		description: 'Bring a project and spend an evening making alongside your neighbors.',
		posterUrl: 'https://files.example.com/open-studio.jpg',
		attachments: [
			{
				name: 'Open studio flyer',
				url: 'https://files.example.com/open-studio.jpg',
				isImage: true
			},
			{ name: 'Event guide', url: 'https://files.example.com/guide.pdf', isImage: false },
			{ name: 'Studio detail', url: 'https://files.example.com/detail.png', isImage: true }
		]
	}
} satisfies ProjectEventRecord;

describe('socialDraftFromProject', () => {
	it('creates editable copy and carries over unique project images', () => {
		const draft = socialDraftFromProject(project);

		expect(draft.title).toBe('Open Studio Night social post');
		expect(draft.body).toContain('November 18, 2026');
		expect(draft.body).toContain('Queerlective CoLab');
		expect(draft.body).toContain('Bring a project');
		expect(draft.assets).toEqual([
			expect.objectContaining({ filename: 'Project cover image' }),
			expect.objectContaining({ filename: 'Studio detail' })
		]);
	});
});
