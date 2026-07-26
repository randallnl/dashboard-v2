import type { ProjectEventRecord, Vote } from '$lib/types/domain';
import { consentDeadline } from '$lib/server/monday/votes';

function recordString(record: Record<string, unknown>, key: string): string {
	return typeof record[key] === 'string' ? record[key] : '';
}

export function communityConsentVotes(
	records: ProjectEventRecord[],
	now: Date = new Date()
): Vote[] {
	const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
	return records.flatMap((record) => {
		if (
			record.source !== 'community' ||
			!record.location.toLocaleLowerCase('en-US').includes("queerlective's colab space")
		) {
			return [];
		}
		const createdText = recordString(record.record, 'creationLog');
		const created = new Date(createdText);
		if (Number.isNaN(created.getTime()) || created.getTime() < cutoff || created > now) return [];
		const submittedAt = created.toISOString().slice(0, 10);
		return [
			{
				id: `community:${record.id}`,
				type: 'Consent Vote' as const,
				question: record.title,
				details: recordString(record.record, 'description'),
				submittedAt,
				deadline: consentDeadline(submittedAt)
			}
		];
	});
}
