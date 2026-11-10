import { error } from '@sveltejs/kit';
import { ProjectEventRepository } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, platform }) => {
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.viewerCapabilities) {
		error(401, 'Authentication required');
	}
	if (layout.isViewingAs || !layout.viewerCapabilities.canManageProjects) {
		error(403, 'Project management access required');
	}
	const records = platform?.env.DB
		? await new ProjectEventRepository(platform.env.DB).list({
				source: 'project',
				includeAdminOnly: true
			})
		: [];
	const workingOnItProjects = records.filter(
		(record) => record.status.trim().toLocaleLowerCase('en-US') === 'working on it'
	);
	const highPriorityProjects = records.filter((record) => {
		const priority = record.record.priority;
		return (
			typeof priority === 'string' &&
			['high', 'high priority'].includes(priority.trim().toLocaleLowerCase('en-US'))
		);
	});

	return {
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		workingOnItProjects,
		highPriorityProjects
	};
};
