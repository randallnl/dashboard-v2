import { describe, expect, it } from 'vitest';
import { memberCapabilities } from './capabilities';

describe('memberCapabilities', () => {
	it('grants admin tools only to administrators', () => {
		expect(memberCapabilities({ membershipType: 'Admin' }).canViewAdminTools).toBe(true);
		expect(memberCapabilities({ membershipType: 'CoLab Member' }).canViewAdminTools).toBe(false);
	});

	it('applies every Retail Only exclusion centrally', () => {
		const capabilities = memberCapabilities({ membershipType: ' Retail Only Member ' });

		expect(capabilities.isRetailOnly).toBe(true);
		expect(capabilities.canViewShifts).toBe(false);
		expect(capabilities.canViewOpenOrders).toBe(false);
		expect(capabilities.canSubmitCommunityEvents).toBe(false);
		expect(capabilities.canViewCalendar).toBe(true);
	});

	it('grants standard member capabilities without admin access', () => {
		const capabilities = memberCapabilities({ membershipType: 'CoLab Member' });

		expect(capabilities.isAdmin).toBe(false);
		expect(capabilities.canViewShifts).toBe(true);
		expect(capabilities.canVote).toBe(true);
	});

	it.each(['Admin', 'Key Holder', 'Keyholder', 'CoLab Member', 'Volunteer'])(
		'grants project management to %s',
		(membershipType) => {
			expect(memberCapabilities({ membershipType }).canManageProjects).toBe(true);
		}
	);

	it('does not grant project management to retail-only members', () => {
		expect(memberCapabilities({ membershipType: 'Retail Only Member' }).canManageProjects).toBe(
			false
		);
	});
});
