import { requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEventRepository, SocialAssetLibraryRepository } from '$lib/server/db';
import { socialDraftFromProject } from '$lib/social/project-draft';
import type { ProjectEventSource } from '$lib/types/domain';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function field(record: Record<string, unknown>, key: string): string {
	return typeof record[key] === 'string' ? record[key].trim() : '';
}

function projectReference(record: Awaited<ReturnType<ProjectEventRepository['findById']>>) {
	if (!record) return null;
	const draft = socialDraftFromProject(record);
	const category = field(record.record, 'goal') || field(record.record, 'category');
	const details = [
		{ label: 'Start', value: record.dateValue },
		{ label: 'End', value: record.endDateValue },
		{ label: 'Status', value: record.status },
		{ label: 'Location', value: record.location },
		{ label: 'Owner', value: record.owner },
		{ label: 'Goal', value: category },
		{ label: 'Deadline', value: field(record.record, 'deadline') }
	].filter((detail) => detail.value);

	return {
		source: record.source,
		id: record.id,
		title: record.title,
		description: field(record.record, 'description').slice(0, 1600),
		details,
		assets: draft.assets
	};
}

export const load: PageServerLoad = async ({ parent, platform, url }) => {
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.viewerCapabilities) {
		error(401, 'Authentication required');
	}
	requireProjectManager({
		viewerCapabilities: layout.viewerCapabilities,
		isViewingAs: layout.isViewingAs ?? false
	});
	const repository = new ProjectEventRepository(platform!.env.DB);
	const requestedSource = url.searchParams.get('source')?.trim() ?? '';
	const requestedId = url.searchParams.get('id')?.trim() ?? '';
	let starter:
		| (ReturnType<typeof socialDraftFromProject> & {
				project: NonNullable<ReturnType<typeof projectReference>>;
		  })
		| null = null;

	if (requestedSource || requestedId) {
		if ((requestedSource !== 'project' && requestedSource !== 'community') || !requestedId) {
			error(400, 'A valid project item is required.');
		}
		if (requestedSource === 'community' && !layout.viewerCapabilities.isAdmin) {
			error(403, 'Only administrators can create social drafts from community events.');
		}
		const record = await repository.findById(requestedSource as ProjectEventSource, requestedId);
		if (!record) error(404, 'Project item not found.');
		const project = projectReference(record);
		starter = { ...socialDraftFromProject(record), project: project! };
	}

	const [projectItems, libraryAssets] = await Promise.all([
		repository.listPage({ source: 'project', includeAdminOnly: true, sort: 'upcoming' }, 1, 50),
		new SocialAssetLibraryRepository(platform!.env.DB).list()
	]);

	return {
		member: layout.member,
		capabilities: layout.capabilities,
		starter,
		projectItems: projectItems.records.map((record) => ({
			id: record.id,
			title: record.title,
			dateValue: record.dateValue
		})),
		libraryAssets
	};
};
