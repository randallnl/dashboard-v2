const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!applicationId || !botToken) {
	throw new Error(
		'Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering the command.'
	);
}

const command = {
	name: 'colab-hours',
	description: 'Show this week’s staffed CoLab open hours',
	type: 1,
	integration_types: [0],
	contexts: [0]
};
const scope = guildId ? `guilds/${guildId}/commands` : 'commands';
const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/${scope}`, {
	method: 'POST',
	headers: {
		Authorization: `Bot ${botToken}`,
		'Content-Type': 'application/json'
	},
	body: JSON.stringify(command)
});

if (!response.ok) {
	throw new Error(
		`Discord command registration failed with HTTP ${response.status}: ${await response.text()}`
	);
}

console.log(`Registered /colab-hours ${guildId ? `in guild ${guildId}` : 'globally'}.`);
