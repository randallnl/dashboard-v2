import type { Activity, Member } from '$lib/types/domain';

export type ScoredWorkActivity = Activity & {
	discountPercent: number;
	reason: string;
	needsReview: boolean;
};

export function membershipPrice(membershipType: string): number | null {
	const type = membershipType.trim().toLocaleLowerCase('en-US');
	if (!type || type === 'admin' || type === 'retail only member' || type === 'volunteer')
		return null;
	if (/full|key\s*holder|keyholder|colab\s*\+\s*retail|retail.*colab|colab.*retail/u.test(type))
		return 30;
	if (/colab/u.test(type)) return 20;
	return null;
}

export function scoreWorkActivity(activity: Activity): ScoredWorkActivity {
	const type = activity.type.toLocaleLowerCase('en-US');
	const detail = `${activity.type} ${activity.description}`.toLocaleLowerCase('en-US');
	const score = (discountPercent: number, reason: string, needsReview = false) => ({
		...activity,
		discountPercent,
		reason,
		needsReview
	});
	if (/plan.*community event|host.*community event|coordinat.*collaboration/u.test(detail))
		return score(75, 'Community event or artist collaboration');
	if (/grant writ|set.?up|break.?down|exhibition|pop.?up/u.test(detail))
		return score(50, 'Event support or grant writing');
	if (/host.*studio hour|programming idea|develop.*program/u.test(detail))
		return score(25, 'Studio-hours hosting or programming');
	if (/inventory|totally tea|fill.*ship.*order/u.test(detail))
		return score(20, 'Retail operations or inventory');
	if (/quarterly sticker|sticker pack/u.test(detail)) return score(15, 'Member-reward fulfillment');
	if (/make.*graphic|graphic|design/u.test(detail)) return score(10, 'Event graphic or design');
	if (/social media|promot/u.test(detail)) return score(5, 'Marketing or outreach');
	if (
		[
			'mopped/sweeped',
			'cleaned tables',
			'reset entry table',
			'took out trash',
			'organized(specify below)'
		].includes(type)
	)
		return score(10, 'CoLab space maintenance');
	if (['new tool announcement', 'opportunities', 'member announcement'].includes(type))
		return score(5, 'Community outreach');
	if (type === 'guest pass' || type === 'check in')
		return score(0, 'Not a work-trade contribution');
	return score(0, 'Unmapped activity—admin review needed', true);
}

export function summarizeWorkTrade(member: Member, month: string, activities: Activity[]) {
	const price = membershipPrice(member.membershipType);
	if (!price) return null;
	const scored = activities
		.filter((activity) => activity.submitDate.startsWith(month))
		.map(scoreWorkActivity);
	const percent = Math.min(
		75,
		scored.reduce((sum, activity) => sum + activity.discountPercent, 0)
	);
	const eligibleDiscount = Math.round(Math.min(price * (percent / 100), price - 10) * 100) / 100;
	return {
		memberId: member.id,
		month,
		membershipType: member.membershipType,
		membershipPrice: price,
		activities: scored,
		activityCount: scored.length,
		eligibleDiscount,
		workSummary: scored.length
			? scored
					.map((activity) => `${activity.submitDate}: ${activity.type} — ${activity.reason}`)
					.join('\n')
			: 'No eligible work activity was logged for this month.'
	};
}
