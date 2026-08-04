import type { EquipmentRequest, ProjectEventRecord, Vote } from '$lib/types/domain';
import { consentDeadline } from '$lib/server/monday/votes';

function recordString(record: Record<string, unknown>, key: string): string {
	return typeof record[key] === 'string' ? record[key] : '';
}

export function communityConsentVotes(
	records: ProjectEventRecord[],
	now: Date = new Date()
): Vote[] {
	return records.flatMap((record) => {
		if (record.source !== 'community' || record.status.toLocaleLowerCase('en-US') !== 'pending') {
			return [];
		}
		const createdText = recordString(record.record, 'creationLog') || record.syncedAt;
		const created = new Date(createdText);
		if (Number.isNaN(created.getTime()) || created > now) return [];
		const submittedAt = created.toISOString().slice(0, 10);
		const deadline = consentDeadline(submittedAt);
		const deadlineEnd = new Date(`${deadline}T23:59:59.999Z`);
		if (deadlineEnd < now) return [];
		return [
			{
				id: `community:${record.id}`,
				type: 'Consent Vote' as const,
				question: record.title,
				details: recordString(record.record, 'description'),
				submittedAt,
				deadline
			}
		];
	});
}

function estimatedCostLabel(value: string): string {
	const normalized = value.trim();
	if (!normalized) return '';
	return normalized.startsWith('$') ? normalized : `$${normalized}`;
}

export function equipmentConsentVotes(
	requests: EquipmentRequest[],
	now: Date = new Date()
): Vote[] {
	return requests.flatMap((request) => {
		const created = new Date(request.submittedAt || request.syncedAt);
		if (Number.isNaN(created.getTime()) || created > now) return [];
		const submittedAt = created.toISOString().slice(0, 10);
		const deadline = consentDeadline(submittedAt);
		if (new Date(`${deadline}T23:59:59.999Z`) < now) return [];
		const details = [
			request.requestor ? `Requested by: ${request.requestor}` : '',
			request.estimatedCost ? `Estimated cost: ${estimatedCostLabel(request.estimatedCost)}` : '',
			request.explanation ? `Need: ${request.explanation}` : '',
			request.additionalInfo ? `Additional information: ${request.additionalInfo}` : ''
		].filter(Boolean);

		return [
			{
				id: `equipment:${request.id}`,
				type: 'Consent Vote' as const,
				question: `Material/equipment request: ${request.title}`,
				details: details.join('\n'),
				submittedAt,
				deadline,
				linkUrl: request.productUrl,
				linkLabel: request.productUrl ? 'View requested item' : ''
			}
		];
	});
}
