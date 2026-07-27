import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import type { ProjectEventSort } from '$lib/server/db/project-repository';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);

	const sourceValue = url.searchParams.get('source')?.trim() ?? '';
	if (sourceValue && sourceValue !== 'project' && sourceValue !== 'community') {
		error(400, 'Source must be project or community.');
	}
	const fromDate = url.searchParams.get('from')?.trim() ?? '';
	const throughDate = url.searchParams.get('through')?.trim() ?? '';
	if ((fromDate && !DATE.test(fromDate)) || (throughDate && !DATE.test(throughDate))) {
		error(400, 'Dates must use YYYY-MM-DD.');
	}
	const requestedPage = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const sortValue = url.searchParams.get('sort')?.trim() || 'upcoming';
	const validSorts = new Set<ProjectEventSort>([
		'upcoming',
		'date-desc',
		'date-asc',
		'title',
		'status',
		'priority'
	]);
	if (!validSorts.has(sortValue as ProjectEventSort)) {
		error(400, 'Invalid project sort.');
	}

	const result = await new ProjectEventRepository(env!.DB).listPage(
		{
			source: sourceValue as ProjectEventSource | undefined,
			status: url.searchParams.get('status')?.trim() ?? '',
			search: url.searchParams.get('search')?.trim() ?? '',
			fromDate,
			throughDate,
			includeAdminOnly: true,
			sort: sortValue as ProjectEventSort
		},
		page
	);
	return json(result, { headers: { 'cache-control': 'private, no-store' } });
};
