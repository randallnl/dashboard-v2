import { describe, expect, it, vi } from 'vitest';
import { RetailRepository } from './retail-repository';

describe('RetailRepository.remove', () => {
	it('removes an order so database cascades remove its dashboard-owned details', async () => {
		const statements: Array<{ sql: string; values: unknown[] }> = [];
		const run = vi.fn(async () => ({ meta: { changes: 1 } }));
		const db = {
			prepare(sql: string) {
				const statement = {
					sql,
					values: [] as unknown[],
					bind(...values: unknown[]) {
						this.values = values;
						return this;
					},
					run
				};
				statements.push(statement);
				return statement;
			}
		} as unknown as D1Database;
		const repository = new RetailRepository(db);
		expect(await repository.remove('a4c9d6b2-987d-4a01-bb1a-6b677491bbcb')).toBe(true);
		expect(run).toHaveBeenCalledOnce();
		expect(statements.map((statement) => statement.sql)).toEqual([
			'DELETE FROM retail_orders WHERE id = ?1'
		]);
	});
});

describe('RetailRepository.setInstruction', () => {
	it('upserts the shared work-instruction link for a retail step', async () => {
		const statements: Array<{ sql: string; values: unknown[] }> = [];
		const run = vi.fn(async () => ({ meta: { changes: 1 } }));
		const db = {
			prepare(sql: string) {
				const statement = {
					sql,
					values: [] as unknown[],
					bind(...values: unknown[]) {
						this.values = values;
						return this;
					},
					run
				};
				statements.push(statement);
				return statement;
			}
		} as unknown as D1Database;

		await new RetailRepository(db).setInstruction({
			stepId: 'received',
			url: 'https://drive.google.com/receiving-checklist',
			label: 'Open receiving checklist',
			updatedBy: 'member-1'
		});

		expect(statements[0].sql).toContain('ON CONFLICT(step_id, url) DO UPDATE');
		expect(statements[0].values).toEqual([
			'received',
			'https://drive.google.com/receiving-checklist',
			'Open receiving checklist',
			'member-1',
			expect.any(String)
		]);
	});

	it('removes a shared instruction link when no URL remains', async () => {
		const statements: Array<{ sql: string; values: unknown[] }> = [];
		const run = vi.fn(async () => ({ meta: { changes: 1 } }));
		const db = {
			prepare(sql: string) {
				const statement = {
					sql,
					values: [] as unknown[],
					bind(...values: unknown[]) {
						this.values = values;
						return this;
					},
					run
				};
				statements.push(statement);
				return statement;
			}
		} as unknown as D1Database;

		await new RetailRepository(db).setInstruction({
			id: 9,
			stepId: 'display',
			url: '',
			label: '',
			updatedBy: 'member-1'
		});

		expect(statements[0]).toMatchObject({
			sql: 'DELETE FROM retail_work_instructions WHERE id = ?1 AND step_id = ?2',
			values: [9, 'display']
		});
	});
});
