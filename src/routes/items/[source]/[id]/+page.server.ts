import { HostRepository, ProjectEventRepository } from '$lib/server/db';
import type { ProjectEventSource } from '$lib/types/domain';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, platform }) => {
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.capabilities || !layout.viewerCapabilities) {
		error(401, 'Authentication required');
	}
	if (params.source !== 'project' && params.source !== 'community') {
		error(404, 'Project or event not found');
	}
	const source = params.source as ProjectEventSource;
	const record = await new ProjectEventRepository(platform!.env.DB).findById(source, params.id);
	if (!record || (record.adminOnly && !layout.viewerCapabilities.isAdmin)) {
		error(404, 'Project or event not found');
	}
	if (layout.capabilities.isRetailOnly && record.source === 'community') {
		error(403, 'This event is not included with this membership.');
	}
	const host = await new HostRepository(platform!.env.DB).find(record.source, record.id);
	const hidden = layout.viewerCapabilities.isAdmin
		? new Set<string>()
		: new Set(['organizerEmail', 'mondayUrl', 'itemId', 'creationLog']);
	return {
		record: {
			...record,
			record: Object.fromEntries(Object.entries(record.record).filter(([key]) => !hidden.has(key)))
		},
		host,
		isAdmin: layout.viewerCapabilities.isAdmin && !layout.isViewingAs,
		readOnly: layout.isViewingAs
	};
};
