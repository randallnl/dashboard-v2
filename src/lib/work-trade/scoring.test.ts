import type { Activity, Member } from '$lib/types/domain';
import { describe, expect, it } from 'vitest';
import { membershipPrice, scoreWorkActivity, summarizeWorkTrade } from './scoring';

const member = (membershipType: string): Member => ({
	id: 'member-1',
	preferredName: 'Alex Morgan',
	membershipType,
	email: 'alex@example.com',
	otherEmails: [],
	phone: '',
	businessName: '',
	website: '',
	socialMedia: '',
	creativeGroundUrl: '',
	artistDescription: '',
	artistPhotoUrl: '',
	artistBannerUrl: '',
	signUpDate: ''
});
const activity = (description: string): Activity => ({
	id: description,
	type: 'Member activity',
	submitDate: '2026-07-12',
	description,
	memberId: 'member-1'
});

describe('work-trade discount scoring', () => {
	it('uses the two membership prices and excludes ineligible membership types', () => {
		expect(membershipPrice('CoLab Member')).toBe(20);
		expect(membershipPrice('Full CoLab + Retail Member')).toBe(30);
		expect(membershipPrice('Key Holder')).toBe(30);
		expect(membershipPrice('CoLab Keyholder')).toBe(30);
		expect(membershipPrice('Retail Only Member')).toBeNull();
		expect(membershipPrice('Admin')).toBeNull();
	});

	it('preserves the ten-dollar minimum for both plans', () => {
		const activities = [activity('Plan community event')];
		expect(
			summarizeWorkTrade(member('CoLab Member'), '2026-07', activities)?.eligibleDiscount
		).toBe(10);
		expect(
			summarizeWorkTrade(member('Full Membership'), '2026-07', activities)?.eligibleDiscount
		).toBe(20);
	});

	it('flags unmapped work for admin review', () => {
		expect(scoreWorkActivity(activity('Helped with something new'))).toMatchObject({
			discountPercent: 0,
			needsReview: true
		});
	});
});
