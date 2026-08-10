import { describe, expect, it, vi } from 'vitest';
import { DiscordVoteNotificationRepository } from './discord-vote-notification-repository';
import type { Database } from './types';

function databaseWithChanges(...changes: number[]) {
	const run = vi.fn();
	for (const value of changes) {
		run.mockResolvedValueOnce({ meta: { changes: value } });
	}
	const bind = vi.fn();
	const statement = { bind, run } as unknown as D1PreparedStatement;
	bind.mockReturnValue(statement);
	const prepare = vi.fn().mockReturnValue(statement);
	const batch = vi.fn().mockResolvedValue([]);
	return { db: { prepare, batch } as Database, prepare, bind, run };
}

describe('DiscordVoteNotificationRepository', () => {
	it('claims a never-announced vote exactly once', async () => {
		const mock = databaseWithChanges(1);
		const repository = new DiscordVoteNotificationRepository(mock.db);

		await expect(
			repository.reserve('equipment:request-1', '2026-08-04T17:00:00Z', '2026-08-04T16:50:00Z')
		).resolves.toBe(true);
		expect(mock.run).toHaveBeenCalledOnce();
	});

	it('does not reclaim a reservation that is still leased', async () => {
		const mock = databaseWithChanges(0, 0);
		const repository = new DiscordVoteNotificationRepository(mock.db);

		await expect(
			repository.reserve('community:event-1', '2026-08-04T17:00:00Z', '2026-08-04T16:50:00Z')
		).resolves.toBe(false);
		expect(mock.run).toHaveBeenCalledTimes(2);
	});

	it('marks successful posts and releases failed posts for retry', async () => {
		const mock = databaseWithChanges(1, 1);
		const repository = new DiscordVoteNotificationRepository(mock.db);

		await repository.markSent('motion-1', '2026-08-04T17:01:00Z');
		await repository.release('motion-2', 'Discord webhook returned HTTP 429');

		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'sent'"));
		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"));
	});

	it('records forced sends even when a motion was already sent', async () => {
		const mock = databaseWithChanges(1);
		const repository = new DiscordVoteNotificationRepository(mock.db);

		await repository.recordForcedSend('motion-1', '2026-08-04T17:02:00Z');

		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(vote_key)'));
		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining('attempts + 1'));
		expect(mock.bind).toHaveBeenCalledWith('motion-1', '2026-08-04T17:02:00Z');
	});
});
