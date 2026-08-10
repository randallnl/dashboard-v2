import type { Vote } from '$lib/types/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discordPayload, postVoteToDiscord, recentVote } from './vote-notifier';

const vote: Vote = {
	id: 'equipment:request-1',
	type: 'Consent Vote',
	question: 'Material/equipment request: Button maker',
	details: 'Requested by: Alex\nEstimated cost: $125',
	submittedAt: '2026-08-04',
	deadline: '2026-09-21',
	linkUrl: 'https://example.com/button-maker',
	linkLabel: 'View requested item'
};

afterEach(() => vi.unstubAllGlobals());

describe('Discord vote notifications', () => {
	it('builds a mention-safe embed with dashboard and related-item links', () => {
		const payload = discordPayload(vote, 'https://dashboard.queerlective.com/');

		expect(payload.allowed_mentions).toEqual({ parse: [] });
		expect(payload.embeds[0]).toMatchObject({
			title: vote.question,
			url: 'https://dashboard.queerlective.com/#votes'
		});
		expect(payload.embeds[0].description).toContain(
			'[View requested item](https://example.com/button-maker)'
		);
	});

	it('only selects motions submitted near the scheduled run', () => {
		const now = new Date('2026-08-04T17:00:00Z');
		expect(recentVote(vote, now)).toBe(true);
		expect(recentVote({ ...vote, submittedAt: '2026-07-20' }, now)).toBe(false);
		expect(recentVote({ ...vote, submittedAt: '2026-08-05' }, now)).toBe(false);
		expect(recentVote({ ...vote, submittedAt: '' }, now)).toBe(false);
	});

	it('posts JSON without reading or logging the webhook response body', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);

		await postVoteToDiscord('https://discord.example/webhook', vote, 'https://dashboard.example');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://discord.example/webhook',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('surfaces Discord delivery failures for D1 retry handling', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

		await expect(
			postVoteToDiscord('https://discord.example/webhook', vote, 'https://dashboard.example')
		).rejects.toThrow('HTTP 429');
	});
});
