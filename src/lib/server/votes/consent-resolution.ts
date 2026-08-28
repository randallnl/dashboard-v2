import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import {
	OBJECTION_RESPONSE,
	type VoteLogEntry,
	voteLogsForMotion,
	VoteDirectory
} from '$lib/server/monday/votes';
import { communityConsentVote } from '$lib/server/votes/eligibility';
import type { ProjectEventRecord } from '$lib/types/domain';

export type ConsentResolution = 'approve' | 'objected' | 'active' | 'ineligible';

export function communityConsentResolution(
	record: ProjectEventRecord,
	logs: VoteLogEntry[],
	now: Date
): ConsentResolution {
	const vote = communityConsentVote(record);
	if (!vote) return 'ineligible';
	if (new Date(vote.submittedAt) > now || new Date(vote.deadline) > now) return 'active';
	return voteLogsForMotion(logs, vote).some((entry) => entry.response === OBJECTION_RESPONSE)
		? 'objected'
		: 'approve';
}

export async function resolveExpiredCommunityConsentVotes(
	env: Pick<CronEnv, 'DB' | 'MONDAY_API_TOKEN'>,
	now: Date = new Date()
) {
	const repository = new ProjectEventRepository(env.DB);
	const records = await repository.list({ source: 'community' });
	const pending = records.filter(
		(record) => record.status.toLocaleLowerCase('en-US') === 'pending'
	);
	if (!pending.length) return { reviewed: 0, approved: 0, objected: 0, failed: 0 };

	const client = new MondayClient(await mondayToken(env.MONDAY_API_TOKEN));
	const logs = await new VoteDirectory(client).listVoteLog();
	const events = new EventDirectory(client);
	let reviewed = 0;
	let approved = 0;
	let objected = 0;
	let failed = 0;

	for (const record of pending) {
		const resolution = communityConsentResolution(record, logs, now);
		if (resolution === 'active' || resolution === 'ineligible') continue;
		reviewed += 1;
		if (resolution === 'objected') {
			objected += 1;
			continue;
		}
		try {
			await events.update('community', record.id, {
				title: record.title,
				dateValue: record.dateValue,
				endDateValue: record.endDateValue,
				status: 'Approved',
				location: record.location,
				description: typeof record.record.description === 'string' ? record.record.description : ''
			});
			await repository.upsert({ ...record, status: 'Approved', syncedAt: now.toISOString() });
			approved += 1;
		} catch (cause) {
			failed += 1;
			console.error(
				JSON.stringify({
					event: 'community_consent_auto_approval_failed',
					itemId: record.id,
					message: cause instanceof Error ? cause.message : 'Unknown approval error'
				})
			);
		}
	}

	return { reviewed, approved, objected, failed };
}
