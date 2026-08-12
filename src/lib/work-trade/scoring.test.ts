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
		const colab = summarizeWorkTrade(member('CoLab Member'), '2026-07', activities);
		const full = summarizeWorkTrade(member('Full Membership'), '2026-07', activities);
		expect(colab?.eligibleDiscount).toBe(10);
		expect(colab?.activities[0]).toMatchObject({ discountAmount: 10, discountOverridden: false });
		expect(full?.eligibleDiscount).toBe(20);
		expect(full?.activities[0]).toMatchObject({ discountAmount: 20, discountOverridden: false });
	});

	it('shows the applied dollar amount on each activity', () => {
		const summary = summarizeWorkTrade(member('CoLab Member'), '2026-07', [
			activity('Make an event graphic'),
			{ ...activity('Promote on social media'), id: 'social' }
		]);
		expect(summary?.activities.map(({ discountAmount }) => discountAmount)).toEqual([2, 1]);
		expect(summary?.eligibleDiscount).toBe(3);
	});

	it('flags unmapped work for admin review', () => {
		expect(scoreWorkActivity(activity('Helped with something new'))).toMatchObject({
			discountPercent: 0,
			needsReview: true
		});
	});
});
