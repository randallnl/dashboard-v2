import {
	discordConfigValue,
	isColabHoursCommand,
	type DiscordInteraction,
	verifyDiscordInteraction
} from '$lib/server/discord/interactions';
import { currentWeekBounds, openHoursDiscordMessage } from '$lib/server/discord/open-hours';
import { ShiftRepository } from '$lib/server/db';
import { json, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EPHEMERAL = 1 << 6;
const NO_MENTIONS = { parse: [] as string[] };

function ephemeralMessage(content: string) {
	return json({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS } });
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform!.env;
	const rawBody = await request.text();
	const signature = request.headers.get('x-signature-ed25519') ?? '';
	const timestamp = request.headers.get('x-signature-timestamp') ?? '';
	const publicKey = await discordConfigValue(env.COLAB_DISCORD_PUBLIC_KEY);

	if (!(await verifyDiscordInteraction(rawBody, signature, timestamp, publicKey))) {
		return text('invalid request signature', { status: 401 });
	}

	let interaction: DiscordInteraction;
	try {
		interaction = JSON.parse(rawBody) as DiscordInteraction;
	} catch {
		return text('invalid interaction payload', { status: 400 });
	}

	// Discord sends this signed request when validating the endpoint in the developer portal.
	if (interaction.type === 1) return json({ type: 1 });

	if (!isColabHoursCommand(interaction)) {
		return ephemeralMessage('I can help with `/colab-hours`.');
	}

	const channelId = await discordConfigValue(env.COLAB_DISCORD_CHANNEL_ID);
	if (!channelId || interaction.channel_id !== channelId) {
		return ephemeralMessage('`/colab-hours` is only available in the CoLab open-hours channel.');
	}

	try {
		const week = currentWeekBounds();
		const shifts = await new ShiftRepository(env.DB).listBetween(week.from, week.through);
		return json({
			type: 4,
			data: {
				content: openHoursDiscordMessage(shifts, week, env.DASHBOARD_URL),
				allowed_mentions: NO_MENTIONS
			}
		});
	} catch (cause) {
		console.error(
			JSON.stringify({
				event: 'discord_open_hours_failed',
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		return ephemeralMessage(
			'Shift availability is temporarily unavailable. Please try again shortly.'
		);
	}
};
