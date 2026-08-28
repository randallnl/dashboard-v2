import {
	DiscordVoteNotificationRepository,
	EquipmentRequestRepository,
	ProjectEventRepository
} from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { VoteDirectory } from '$lib/server/monday/votes';
import { communityConsentVotes, equipmentConsentVotes } from '$lib/server/votes/eligibility';
import type { Vote } from '$lib/types/domain';

type VoteNotifierEnv = Pick<CronEnv, 'DB' | 'MONDAY_API_TOKEN' | 'COLAB_WEBHOOK' | 'DASHBOARD_URL'>;

const RECENT_VOTE_MS = 48 * 60 * 60 * 1000;
const RESERVATION_LEASE_MS = 10 * 60 * 1000;

function truncate(value: string, maximum: number): string {
	return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function logSourceFailure(source: string, cause: unknown): void {
	console.error(
		JSON.stringify({
			event: 'discord_vote_source_failed',
			source,
			message: cause instanceof Error ? cause.message : 'Unknown vote source error'
		})
	);
}

async function attempt<T>(source: string, operation: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await operation();
	} catch (cause) {
		logSourceFailure(source, cause);
		return fallback;
	}
}

export function recentVote(vote: Vote, now: Date): boolean {
	const submitted = new Date(vote.submittedAt);
	if (Number.isNaN(submitted.getTime())) return false;
	return submitted <= now && submitted.getTime() >= now.getTime() - RECENT_VOTE_MS;
}

export function discordPayload(vote: Vote, dashboardUrl: string) {
	const relatedLink = vote.linkUrl
		? `\n\n[${vote.linkLabel || 'View related link'}](${vote.linkUrl})`
		: '';
	return {
		username: 'Queerlective Dashboard',
		allowed_mentions: { parse: [] },
		embeds: [
			{
				title: truncate(vote.question, 256),
				description: truncate(
					`${vote.details || 'A new community motion is ready.'}${relatedLink}`,
					4096
				),
				url: `${dashboardUrl.replace(/\/$/u, '')}/#votes`,
				color: 0x194639,
				fields: [
					{ name: 'Vote type', value: vote.type, inline: true },
					...(vote.deadline ? [{ name: 'Respond by', value: vote.deadline, inline: true }] : [])
				],
				footer: { text: 'Open the member dashboard to vote.' }
			}
		]
	};
}

export async function postVoteToDiscord(
	webhookUrl: string,
	vote: Vote,
	dashboardUrl: string
): Promise<void> {
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(discordPayload(vote, dashboardUrl))
	});
	if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}`);
}

async function availableVotes(env: VoteNotifierEnv, now: Date): Promise<Vote[]> {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	const [motions, community, equipment] = await Promise.all([
		new VoteDirectory(new MondayClient(token)).listMotions(),
		new ProjectEventRepository(env.DB).list({ source: 'community' }),
		new EquipmentRequestRepository(env.DB).list()
	]);
	return [
		...motions,
		...communityConsentVotes(community, now),
		...equipmentConsentVotes(equipment, now)
	];
}

export async function notifySpecificVote(env: VoteNotifierEnv, voteId: string) {
	const votes = await availableVotes(env, new Date());
	const vote = votes.find((candidate) => candidate.id === voteId);
	if (!vote)
		throw new Error('That motion is no longer available. Refresh the motions and try again.');

	const webhookUrl = await env.COLAB_WEBHOOK.get();
	await postVoteToDiscord(webhookUrl, vote, env.DASHBOARD_URL);
	await new DiscordVoteNotificationRepository(env.DB).recordForcedSend(
		vote.id,
		new Date().toISOString()
	);
	return vote;
}

export async function notifyNewVotes(env: VoteNotifierEnv, scheduledTime: number) {
	const now = new Date(scheduledTime);
	const webhookUrlPromise = env.COLAB_WEBHOOK.get();
	const [motions, community, equipment, webhookUrl] = await Promise.all([
		attempt(
			'monday_motions',
			async () => {
				const token = await mondayToken(env.MONDAY_API_TOKEN);
				return new VoteDirectory(new MondayClient(token)).listMotions();
			},
			[] as Vote[]
		),
		attempt(
			'community_events',
			() => new ProjectEventRepository(env.DB).list({ source: 'community' }),
			[]
		),
		attempt('equipment_requests', () => new EquipmentRequestRepository(env.DB).list(), []),
		webhookUrlPromise
	]);
	const votes = [
		...motions,
		...communityConsentVotes(community, now),
		...equipmentConsentVotes(equipment, now)
	].filter((vote) => recentVote(vote, now));
	const repository = new DiscordVoteNotificationRepository(env.DB);
	let posted = 0;
	let failed = 0;

	for (const vote of votes) {
		const reservedAt = new Date().toISOString();
		const staleBefore = new Date(Date.now() - RESERVATION_LEASE_MS).toISOString();
		if (!(await repository.reserve(vote.id, reservedAt, staleBefore))) continue;
		try {
			await postVoteToDiscord(webhookUrl, vote, env.DASHBOARD_URL);
			await repository.markSent(vote.id, new Date().toISOString());
			posted += 1;
		} catch (cause) {
			failed += 1;
			const message = cause instanceof Error ? cause.message : 'Unknown Discord error';
			await repository.release(vote.id, message);
			console.error(
				JSON.stringify({ event: 'discord_vote_post_failed', voteId: vote.id, message })
			);
		}
	}

	return { eligible: votes.length, posted, failed };
}
