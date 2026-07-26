import type { GivebutterSignup } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { syncGivebutter } from './sync';

const signup = {
	id: 'signup-1',
	campaignId: 'campaign-42'
} as GivebutterSignup;

describe('syncGivebutter', () => {
	it('persists signups, continues after record failures, and prunes missing rows', async () => {
		const source = {
			list: vi.fn().mockResolvedValue([signup, { ...signup, id: 'signup-2' }])
		};
		const store = {
			upsert: vi
				.fn()
				.mockRejectedValueOnce(new Error('Malformed record'))
				.mockResolvedValueOnce(undefined),
			removeMissing: vi.fn().mockResolvedValue(3)
		};

		await expect(syncGivebutter(source, store)).resolves.toMatchObject({
			count: 1,
			failed: 1,
			removed: 3
		});
		expect(store.removeMissing).toHaveBeenCalledWith(['signup-1', 'signup-2']);
	});
});
