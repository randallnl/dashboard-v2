import { describe, expect, it } from 'vitest';
import { canAccessMember } from './member-context';

describe('canAccessMember', () => {
	it('allows every member to access their own record', () => {
		expect(canAccessMember('member-1', 'member-1', { isAdmin: false })).toBe(true);
	});

	it('rejects a non-admin attempting to access another member', () => {
		expect(canAccessMember('member-1', 'member-2', { isAdmin: false })).toBe(false);
	});

	it('allows an admin to access another member', () => {
		expect(canAccessMember('admin-1', 'member-2', { isAdmin: true })).toBe(true);
	});
});
