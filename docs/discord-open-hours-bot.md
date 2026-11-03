# CoLab Discord open-hours bot

Members can type `/colab-hours` in the configured CoLab Discord channel to see the
current Monday–Sunday open hours that are staffed. The answer is public, does not
ping anyone, and links members back to the dashboard schedule.

The dashboard’s scheduled sync refreshes the source-of-truth Monday.com shift data
in D1 every 15 minutes. The command reads that cache, so it responds within Discord's
interaction-response window without giving Discord access to Monday.com.

## One-time Discord setup

1. Create a Discord Application in the Developer Portal. Add a bot user only if you
   want the application to appear as a bot in the server; the slash command itself
   uses Discord Interactions and does not need a gateway connection.
2. Copy the application **Public Key** from General Information and the target
   channel's ID (enable Discord Developer Mode, then right-click the channel and
   choose **Copy Channel ID**).
3. In the `dashboard-v2` Worker's **Settings → Variables and Secrets**, store
   them as encrypted secrets named `COLAB_DISCORD_PUBLIC_KEY` and
   `COLAB_DISCORD_CHANNEL_ID`.
4. Deploy the application Worker, then set the Discord application's Interactions
   Endpoint URL to:

   ```text
   https://dashboard.queerlective.com/api/discord/interactions
   ```

   Discord will send a signed PING while saving the URL. A valid PONG confirms the
   endpoint is configured correctly.

5. Install the app in the CoLab server with the `applications.commands` scope. For
   a visible bot account, include the `bot` scope as well.
6. Register the command. Use a guild ID while testing so it appears immediately:

   ```sh
   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... \
     npm run discord:register-open-hours
   ```

   Omit `DISCORD_GUILD_ID` only when you are ready to register it globally.

## Local development

Copy the public key and channel ID to `.dev.vars`; both are required for the
interaction endpoint. Do not commit `.dev.vars` or the bot token. The registration
script reads the application ID and bot token only from the shell environment and
never sends either to the dashboard.

## Security behavior

- Every interaction is verified against Discord's Ed25519 signature before its JSON
  is parsed.
- The exact raw request body is used for verification.
- `/colab-hours` only responds in the configured channel; other channels receive an
  ephemeral explanation.
- Responses disable Discord mentions so a shift title cannot unexpectedly notify a
  member or role.
