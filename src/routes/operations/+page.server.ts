import { error } from '@sveltejs/kit';
import { OPERATIONS_DOCUMENT_ROOT } from '$lib/drive-libraries';
import { DriveDocumentRepository, ProjectEventRepository } from '$lib/server/db';
import type { DriveDocument } from '$lib/types/drive';
import type { ProjectEventRecord } from '$lib/types/domain';
import type { PageServerLoad } from './$types';

const GOVERNANCE_DOCUMENT_TERMS = ['board', 'governance', 'director', 'committee', 'trustee'];
const GOVERNANCE_RECORD_PATTERN =
	/\b(?:governance|committee|trustee|director|board\s+(?:of\s+)?(?:directors|meeting|retreat|packet|minutes|agenda|member|officer|term|resolution|vote))\b/iu;

function recordFieldText(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' ');
	return '';
}

function isGovernanceRecord(record: ProjectEventRecord): boolean {
	const text = [
		record.title,
		record.location,
		recordFieldText(record.record, 'description'),
		recordFieldText(record.record, 'category'),
		recordFieldText(record.record, 'goal'),
		recordFieldText(record.record, 'strategicGoal'),
		recordFieldText(record.record, 'tags'),
		recordFieldText(record.record, 'labels')
	].join(' ');
	return GOVERNANCE_RECORD_PATTERN.test(text);
}

function isGovernanceDocument(document: DriveDocument): boolean {
	return GOVERNANCE_DOCUMENT_TERMS.some((term) =>
		[document.name, document.category, document.summary, document.keywords]
			.join(' ')
			.toLocaleLowerCase('en-US')
			.includes(term)
	);
}

export const load: PageServerLoad = async ({ parent, platform, url }) => {
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.viewerCapabilities) {
		error(401, 'Authentication required');
	}
	if (layout.isViewingAs || !layout.viewerCapabilities.isAdmin) {
		error(403, 'Operations access required');
	}

	const governanceActive = url.searchParams.get('tab') === 'governance';
	const today = new Date().toISOString().slice(0, 10);
	const db = platform?.env.DB;
	let governanceMeetings: ProjectEventRecord[] = [];
	let governanceDocuments: DriveDocument[] = [];

	if (governanceActive && db) {
		const [records, documents] = await Promise.all([
			new ProjectEventRepository(db).list({
				source: 'project',
				includeAdminOnly: true
			}),
			new DriveDocumentRepository(db, OPERATIONS_DOCUMENT_ROOT).list(['admin'])
		]);
		governanceMeetings = records.filter(isGovernanceRecord);
		governanceDocuments = documents
			.filter((document) => !document.isFolder && isGovernanceDocument(document))
			.sort((first, second) => second.modifiedAt.localeCompare(first.modifiedAt))
			.slice(0, 4);
	}

	return {
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		dashboardDate: today,
		governanceMeetings,
		governanceDocuments
	};
};
