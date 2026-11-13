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
