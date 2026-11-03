import { publicStaffedHours, newYorkDate, weekBounds } from '$lib/public/colab-updates';
import { ShiftRepository } from '$lib/server/db';
import type { PageServerLoad } from './$types';

const quickLinks = [
	{
		label: 'Vendor portal',
		description: 'Manage your vendor profile, products, and inventory.',
		href: 'https://portal.queerlective.com/login'
	},
	{
		label: 'CoLab inventory',
		description: 'Check shared tools, materials, and supplies before buying new.',
		href: 'https://queerlective.com/pages/colab-inventory'
	},
	{
		label: 'Request materials',
		description: 'Tell us what would make your work at CoLab easier.',
		href: 'https://wkf.ms/4sNxnqk'
	},
	{
		label: 'Share an update',
		description: 'Send announcements, opportunities, or feedback for the hub.',
		href: 'https://forms.monday.com/forms/ddce8c6fe8b66ee69ab375ec8e68f09e?r=use1'
	}
];

export const load: PageServerLoad = async ({ platform }) => {
	const bounds = weekBounds(newYorkDate());
	const shifts = platform?.env.DB
		? await new ShiftRepository(platform.env.DB).listBetween(bounds.from, bounds.through)
		: [];

	return {
		week: bounds,
		staffedHours: publicStaffedHours(shifts),
		quickLinks,
		dashboardUrl: platform?.env.DASHBOARD_URL ?? 'https://dashboard.queerlective.com'
	};
};
