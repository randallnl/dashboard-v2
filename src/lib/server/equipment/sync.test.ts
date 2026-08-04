import type { EquipmentRequest } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { syncEquipmentRequests } from './sync';

const request = {
	id: 'request-1',
	title: 'Button maker'
} as EquipmentRequest;

describe('syncEquipmentRequests', () => {
	it('persists requests, continues after failures, and prunes missing rows', async () => {
		const source = {
			list: vi.fn().mockResolvedValue([request, { ...request, id: 'request-2' }])
		};
		const store = {
			upsert: vi
				.fn()
				.mockRejectedValueOnce(new Error('Malformed request'))
				.mockResolvedValueOnce(undefined),
			removeMissing: vi.fn().mockResolvedValue(2)
		};

		await expect(syncEquipmentRequests(source, store)).resolves.toMatchObject({
			count: 1,
			failed: 1,
			removed: 2
		});
		expect(store.removeMissing).toHaveBeenCalledWith(['request-1', 'request-2']);
	});
});
