import type { ProjectEventRecord, Shift } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { AuthRepository } from './auth-repository';
import { ProjectEventRepository } from './project-repository';
import { ShiftRepository } from './shift-repository';
import type { Database } from './types';

function createDatabaseMock(options: { changes?: number; first?: unknown } = {}) {
	const bind = vi.fn();
	const run = vi.fn().mockResolvedValue({
		success: true,
		results: [],
		meta: { changes: options.changes ?? 1 }
	});
	const first = vi.fn().mockResolvedValue(options.first ?? null);
	const all = vi.fn().mockResolvedValue({ success: true, results: [], meta: { changes: 0 } });
	const raw = vi.fn().mockResolvedValue([]);
	const statement = { bind, run, first, all, raw } as D1PreparedStatement;
	bind.mockReturnValue(statement);
	const prepare = vi.fn().mockReturnValue(statement);
	const batch = vi.fn().mockResolvedValue([]);
	const db = { prepare, batch } as Database;

	return { db, statement, prepare, bind, run, first, all, raw, batch };
}

describe('AuthRepository', () => {
	it('inserts only the hashed login token and normalized metadata', async () => {
		const mock = createDatabaseMock();
		const repository = new AuthRepository(mock.db);

		await repository.createLoginToken({
			tokenHash: 'hashed-token',
			email: 'member@example.com',
			expiresAt: '2026-07-24T12:15:00.000Z'
		});

		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining('magic_login_tokens'));
		expect(mock.bind).toHaveBeenCalledWith(
			'hashed-token',
			'member@example.com',
			'2026-07-24T12:15:00.000Z'
		);
		expect(mock.run).toHaveBeenCalledOnce();
	});

	it('checks both unused state and expiration when reading a token', async () => {
		const mock = createDatabaseMock();
		const repository = new AuthRepository(mock.db);

		await repository.findValidLoginToken('hashed-token', '2026-07-24T12:00:00.000Z');

		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining("used_at = ''"));
		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining('expires_at > ?2'));
		expect(mock.bind).toHaveBeenCalledWith('hashed-token', '2026-07-24T12:00:00.000Z');
	});

	it('reports whether a single-use token was consumed', async () => {
		const successful = createDatabaseMock({ changes: 1 });
		const alreadyUsed = createDatabaseMock({ changes: 0 });

		await expect(
			new AuthRepository(successful.db).consumeLoginToken(
				'hashed-token',
				'2026-07-24T12:00:00.000Z'
			)
		).resolves.toBe(true);
		await expect(
			new AuthRepository(alreadyUsed.db).consumeLoginToken(
				'hashed-token',
				'2026-07-24T12:00:00.000Z'
			)
		).resolves.toBe(false);
	});
});

describe('ShiftRepository', () => {
	it('performs a complete idempotent upsert', async () => {
		const mock = createDatabaseMock();
		const repository = new ShiftRepository(mock.db);
		const shift: Shift = {
			id: 'shift-1',
			boardId: '8374554428',
			parentId: 'month-1',
			month: 'July',
			title: 'Studio shift',
			dateLabel: 'Jul 28',
			dateValue: '2026-07-28',
			timeLabel: '6pm-8pm',
			memberId: '',
			person: '',
			coveredBy: '',
			coverageStatus: 'Open',
			isCovered: false,
			tags: ['weekday'],
			syncedAt: '2026-07-24T12:00:00.000Z'
		};

		await repository.upsert(shift);

		expect(mock.prepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(id) DO UPDATE'));
		expect(mock.bind).toHaveBeenCalledWith(
			'shift-1',
			'8374554428',
			'month-1',
			'July',
			'Studio shift',
			'Jul 28',
			'2026-07-28',
			'6pm-8pm',
			'',
			'',
			'',
			'Open',
			0,
			'["weekday"]',
			'2026-07-24T12:00:00.000Z'
		);
	});
});

describe('ProjectEventRepository', () => {
	it('stores the normalized fields and complete JSON record', async () => {
		const mock = createDatabaseMock();
		const repository = new ProjectEventRepository(mock.db);
		const event: ProjectEventRecord = {
			id: 'event-1',
			source: 'project',
			title: 'Open studio',
			dateValue: '2026-08-01',
			endDateValue: '',
			status: 'Scheduled',
			location: 'CoLab',
			owner: 'Queerlective',
			adminOnly: false,
			record: { registrationUrl: 'https://example.com' },
			syncedAt: '2026-07-24T12:00:00.000Z'
		};

		await repository.upsert(event);

		expect(mock.prepare).toHaveBeenCalledWith(
			expect.stringContaining('ON CONFLICT(source, id) DO UPDATE')
		);
		expect(mock.bind).toHaveBeenCalledWith(
			'event-1',
			'project',
			'Open studio',
			'2026-08-01',
			'',
			'Scheduled',
			'CoLab',
			'Queerlective',
			0,
			'{"registrationUrl":"https://example.com"}',
			'2026-07-24T12:00:00.000Z'
		);
	});
});
