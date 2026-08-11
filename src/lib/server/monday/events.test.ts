import { describe, expect, it, vi } from 'vitest';
import type { MondayClient } from './client';
import { attendeeEmails, EventDirectory, mapCommunityEvent, mapProjectEvent } from './events';

describe('Monday event mapping', () => {
	it('marks project events outside member locations as admin-only', () => {
		const event = mapProjectEvent(
			{
				id: 'event-1',
				name: 'Internal planning',
				column_values: [
					{ id: 'date_mkns6cak', text: 'Jul 30', value: '{"date":"2026-07-30"}' },
					{ id: 'dropdown_mknqezw8', text: 'Staff Office', value: null }
				]
			},
			'2026-07-26T16:00:00.000Z'
		);
		expect(event.adminOnly).toBe(true);
	});

	it('allows approved CoLab locations and preserves multi-day dates', () => {
		const event = mapProjectEvent(
			{
				id: 'event-2',
				name: 'Open studio',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-07-30"}' },
					{ id: 'date_mm171v9p', text: '', value: '{"date":"2026-08-02"}' },
					{ id: 'dropdown_mknqezw8', text: 'Community Room', value: null },
					{ id: 'text_mm5myb9c', text: 'campaign-42', value: null }
				]
			},
			'2026-07-26T16:00:00.000Z'
		);
		expect(event).toMatchObject({
			adminOnly: false,
			dateValue: '2026-07-30',
			endDateValue: '2026-08-02',
			record: {
				campaignId: 'campaign-42',
				mondayUrl: 'https://queerlective.monday.com/boards/8390893779/pulses/event-2'
			}
		});
	});

	it('maps attendee emails from the project dropdown', () => {
		const event = mapProjectEvent(
			{
				id: 'event-attendees',
				name: 'Volunteer project',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-08-01"}' },
					{ id: 'dropdown_mknqezw8', text: 'CoLab', value: null },
					{
						id: 'dropdown_mm17a53k',
						text: 'one@example.com, two@example.com',
						value: null
					}
				]
			},
			'2026-07-26T16:00:00.000Z'
		);

		expect(event.record.attendees).toBe('one@example.com, two@example.com');
		expect(attendeeEmails(event.record.attendees)).toEqual(['one@example.com', 'two@example.com']);
	});

	it('maps Monday item updates and replies into synchronization metadata', () => {
		const event = mapProjectEvent(
			{
				id: 'event-updates',
				name: 'Updated project',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-08-01"}' },
					{ id: 'dropdown_mknqezw8', text: 'CoLab', value: null }
				],
				updates: [
					{
						id: 'update-1',
						text_body: 'Main update',
						created_at: '2026-07-27T10:00:00.000Z',
						creator_id: 'user-1',
						creator: { name: 'Alex Morgan' },
						replies: [
							{
								id: 'reply-1',
								text_body: 'A reply',
								created_at: '2026-07-27T10:30:00.000Z',
								creator_id: 'user-2',
								creator: { name: 'Rae Jones' }
							}
						]
					}
				]
			},
			'2026-07-27T11:00:00.000Z'
		);

		expect(event.record._mondayUpdates).toEqual([
			expect.objectContaining({ id: 'update-1', textBody: 'Main update' }),
			expect.objectContaining({ id: 'reply-1', textBody: 'A reply' })
		]);
	});

	it('maps project subitems into dated project tasks', () => {
		const event = mapProjectEvent(
			{
				id: 'event-tasks',
				name: 'Field trip',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-08-08"}' },
					{ id: 'dropdown_mknqezw8', text: 'CoLab', value: null }
				],
				subitems: [
					{
						id: 'task-1',
						name: 'Confirm transportation',
						updates: [
							{
								id: 'task-update-1',
								text_body: 'Bus quote received.',
								created_at: '2026-07-28T10:00:00.000Z',
								creator_id: 'user-1',
								creator: { name: 'Alex Morgan' }
							}
						],
						column_values: [
							{ id: 'person', text: 'Alex Morgan', value: null },
							{ id: 'status', text: 'Working on it', value: null },
							{ id: 'date_mm0yt95b', text: '', value: '{"date":"2026-08-02"}' },
							{ id: 'date0', text: '', value: null }
						]
					}
				]
			},
			'2026-07-27T11:00:00.000Z'
		);

		expect(event.record.tasks).toEqual([
			expect.objectContaining({
				id: 'task-1',
				title: 'Confirm transportation',
				owner: 'Alex Morgan',
				status: 'Working on it',
				dueDate: '2026-08-02',
				completed: false,
				comments: [expect.objectContaining({ id: 'task-update-1', body: 'Bus quote received.' })]
			})
		]);
	});

	it('prefers the original public asset URL over Monday’s small thumbnail', () => {
		const event = mapProjectEvent(
			{
				id: 'event-poster',
				name: 'Poster event',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-08-01"}' },
					{ id: 'dropdown_mknqezw8', text: 'CoLab', value: null },
					{
						id: 'file_mknscbex',
						text: 'poster.jpg',
						value: null,
						files: [
							{
								name: 'Poster.jpg',
								is_image: true,
								asset: {
									public_url: 'https://cdn.monday.com/original/poster.jpg',
									url_thumbnail: 'https://cdn.monday.com/thumbnail/poster.jpg',
									file_extension: 'jpg'
								}
							}
						]
					}
				]
			},
			'2026-07-26T16:00:00.000Z'
		);

		expect(event.record.posterUrl).toBe('https://cdn.monday.com/original/poster.jpg');
		expect(event.record.attachments).toEqual([
			{
				name: 'Poster.jpg',
				url: 'https://cdn.monday.com/original/poster.jpg',
				isImage: true
			}
		]);
	});

	it('defaults community submissions to pending and member-visible', () => {
		const event = mapCommunityEvent(
			{
				id: 'community-1',
				name: 'Print night',
				column_values: [{ id: 'date_Mjj7b71V', text: '', value: '{"date":"2026-08-04"}' }]
			},
			'2026-07-26T16:00:00.000Z'
		);
		expect(event).toMatchObject({
			source: 'community',
			status: 'Pending',
			adminOnly: false,
			record: {
				itemId: 'community-1',
				mondayUrl: 'https://queerlective.monday.com/boards/8052311890/pulses/community-1'
			}
		});
	});

	it('updates editable project fields in Monday with type-aware values', async () => {
		const request = vi.fn().mockResolvedValue({ change_multiple_column_values: { id: 'event-1' } });
		const directory = new EventDirectory({ request } as unknown as MondayClient);

		await directory.update('project', 'event-1', {
			title: 'Updated studio night',
			dateValue: '2026-08-10',
			endDateValue: '2026-08-11',
			status: 'Scheduled',
			location: 'CoLab',
			description: 'Updated details'
		});

		expect(request).toHaveBeenCalledWith(
			expect.stringContaining('change_multiple_column_values'),
			expect.objectContaining({
				boardId: '8390893779',
				itemId: 'event-1',
				columnValues: expect.stringContaining('"name":"Updated studio night"')
			})
		);
	});

	it('writes normalized attendee emails to the project dropdown', async () => {
		const request = vi.fn().mockResolvedValue({ change_multiple_column_values: { id: 'event-1' } });
		const directory = new EventDirectory({ request } as unknown as MondayClient);

		await directory.updateProjectAttendees('event-1', [
			'Member@Example.com',
			'member@example.com',
			'second@example.com'
		]);

		expect(request).toHaveBeenCalledWith(
			expect.stringContaining('create_labels_if_missing: true'),
			expect.objectContaining({
				boardId: '8390893779',
				itemId: 'event-1',
				columnValues: JSON.stringify({
					dropdown_mm17a53k: {
						labels: ['member@example.com', 'second@example.com']
					}
				})
			})
		);
	});

	it('creates project tasks and task comments in Monday', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce({ create_subitem: { id: 'task-1', name: 'Book the bus' } })
			.mockResolvedValueOnce({
				create_update: {
					id: 'update-1',
					text_body: 'Bus booked.',
					created_at: '2026-07-28T12:00:00.000Z',
					creator: { name: 'Alex Morgan' }
				}
			});
		const directory = new EventDirectory({ request } as unknown as MondayClient);

		await expect(
			directory.createProjectTask('project-1', {
				title: 'Book the bus',
				status: 'Not started',
				dueDate: '2026-08-02'
			})
		).resolves.toEqual({ id: 'task-1', title: 'Book the bus' });
		await expect(directory.createTaskComment('task-1', 'Bus booked.')).resolves.toMatchObject({
			id: 'update-1',
			body: 'Bus booked.'
		});
		expect(request).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('create_subitem'),
			expect.objectContaining({ parentItemId: 'project-1' })
		);
		expect(request).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining('create_update'),
			expect.objectContaining({ itemId: 'task-1' })
		);
	});

	it('creates a member onboarding project with calendar and attendee details', async () => {
		const request = vi.fn().mockResolvedValue({
			create_item: { id: 'project-1', name: 'Onboarding: Alex Morgan' }
		});
		const directory = new EventDirectory({ request } as unknown as MondayClient);

		await expect(
			directory.createOnboardingProject({
				memberName: 'Alex Morgan',
				email: 'Alex@Example.com',
				startDate: '2026-08-11',
				endDate: '2026-08-18',
				description: 'New member onboarding.'
			})
		).resolves.toEqual({ id: 'project-1', title: 'Onboarding: Alex Morgan' });
		expect(request).toHaveBeenCalledWith(
			expect.stringContaining('create_labels_if_missing: true'),
			expect.objectContaining({
				boardId: '8390893779',
				itemName: 'Onboarding: Alex Morgan',
				columnValues: expect.stringContaining('alex@example.com')
			})
		);
	});
});
