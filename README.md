# LegoChris Bot V2

Discord bot with AI, TTS, ticket system, reaction roles, and soundboard features.

## Features

- AI chat: responds to messages that mention the bot.
- AI voice: reads the AI response in voice when voice mode is enabled.
- Classic TTS: reads messages from muted users in the configured voice channel.
- Tickets: creates, claims, and closes tickets with a final transcript.
- Reaction roles: adds and removes roles through reactions.
- Soundboard: plays audio files in voice channels.

## Requirements

- Node.js 18 or later.
- A Discord bot token.
- A Discord application/client ID.
- A guild ID if you want to register commands only in a test server.
- A Gemini API key for AI chat.

## Installation

1. Clone the project.

```bash
git clone https://github.com/GabryCoso24/LegoChrisBot_V2.git
cd LegoChrisBot_V2
```

2. Install the bot dependencies.

```bash
cd core
npm install
```

3. Configure `core/src/config/.env`.

If it does not exist yet, copy the template in the project and rename it to `.env`.

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

AI_SERVICE_URL=http://localhost:5000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
GEMINI_FALLBACK_MODELS=
GEMINI_RETRIES=3

TTS_LANG=it
TTS_SLOW=false

BOT_NAME=LegoChrisBot
PRESENCE_STATUS=online
ACTIVITY_TYPE=WATCHING
ACTIVITY_TEXT=🧱 | I Mattoncini di LegoChris

STAFF_ROLE_ID=
```

4. Start the bot.

```bash
node src/index.js
```

## Main Structure

```text
core/
├── src/
│   ├── index.js
│   ├── commands/
│   ├── config/
│   ├── lib/
│   └── scripts/
├── modules/
└── data/
```

## Available Commands

### `ai`
Manages the AI assistant in chat and voice.

- `/ai join`: the bot joins your voice channel and enables AI voice mode by default.
    - You must already be in a voice channel.
- `/ai mode`: enables or disables AI voice mode in the server.
    - Works only after `/ai join`.
    - When enabled, pinging the bot in chat returns a text response and a spoken voice response.

Usage example:

```text
/ai join
/ai mode
```

### `tts`
Manages classic TTS and text-to-audio generation.

- `/tts text testo:<text>`: generates an audio file from the provided text and sends it as an attachment.
- `/tts join`: the bot joins your voice channel and enables the TTS reader.
    - You must already be in a voice channel.
- `/tts mode`: enables or disables TTS reading in the current voice channel.
    - Works only after `/tts join`.
- `/tts leave`: disables the TTS reader and leaves the voice channel.
- `/tts status`: shows the current TTS reader status.

How the TTS reader works:

- it only reads messages from users present in the linked voice channel;
- it only reads users who are self muted or server muted;
- it ignores bots, long links, and empty messages.

Usage examples:

```text
/tts text testo:Hello everyone
/tts join
/tts mode
/tts status
/tts leave
```

### `ticket`
Manages the ticket system.

- `/ticket setup [canale]`: sends the ticket panel to the selected channel or the current channel.
    - Publishes the panel image and the dropdown menu with categories.
- `/ticket claim [canale]`: claims a ticket even outside the ticket channel.
    - The `canale` parameter is optional.
    - If the ticket is already claimed, the bot reports it.
- `/ticket close reason:<reason> [canale]`: closes a ticket and generates the transcript.
    - The `reason` parameter is required.
    - The `canale` parameter is optional.
    - The transcript is saved in `core/data/tickets/transcripts/` and sent to the configured log channel.

Permissions and behavior:

- only staff can use `claim` and `close`;
- `setup` can be used in the current channel or in a specified text channel;
- the ticket channel is deleted after closing;
- if it is the last ticket in its parent category, the empty category is also removed.

Usage examples:

```text
/ticket setup canale:#ticket-opening
/ticket claim canale:#ticket-mario
/ticket close reason:Issue resolved canale:#ticket-mario
```

### `reactionrole`
Manages reaction roles on the selected message.

- `/reactionrole set message_id:<id> emoji:<emoji> role:<role>`: links a reaction to a role.
- `/reactionrole remove message_id:<id> emoji:<emoji>`: removes the link.

Operational requirements:

- the bot must have the `Manage Roles` permission;
- the target message must be reachable in the current channel;
- when a user reacts or removes the reaction, the role is automatically added or removed.

Usage examples:

```text
/reactionrole set message_id:123456789012345678 emoji:🔥 role:@Events
/reactionrole remove message_id:123456789012345678 emoji:🔥
```

### `message`
Sends a predefined embed message to a specific text channel.

- `/message tipo:reaction_roles canale:<channel>`: sends the reaction roles embed message.

At the moment, the only available type is `reaction_roles`.

Usage example:

```text
/message tipo:reaction_roles canale:#announcements
```

### `soundboard`
Manages the audio soundboard.

- `/soundboard playsound nome:<sound> [canale]`: adds a sound to the queue and starts playback.
    - `canale` is optional.
    - If omitted, the bot uses your current voice channel.
    - The name can be provided with or without an extension.
- `/soundboard skip`: skips the currently playing sound.
- `/soundboard stop`: stops playback and clears the queue.
- `/soundboard queue`: shows the current track and queued sounds.
- `/soundboard listsounds`: lists all available sounds.

Audio file notes:

- files must be placed in `core/data/soundboard/`;
- only `.mp3` and `.wav` are supported;
- some names may be hidden by the system.

Usage examples:

```text
/soundboard playsound nome:airhorn
/soundboard playsound nome:airhorn canale:#voice-1
/soundboard queue
/soundboard skip
/soundboard stop
/soundboard listsounds
```

## Automatic Bot Behavior

- If you mention the bot in chat and AI voice is enabled in the server, the bot replies in text and can speak in the connected voice channel.
- If the TTS reader is enabled, the bot reads messages from muted users in the configured voice channel.
- Reaction roles are handled through reaction events, not only through slash commands.
- Tickets save their history to markdown files before closing.

## Useful Scripts

The `core/package.json` file also includes these Discord command cleanup scripts:

```bash
npm run commands:clear
npm run commands:clear:global
npm run commands:clear:guild
```

Run them from inside the `core` folder.

## Important Configuration

The bot reads configuration from `core/src/config/.env`.

Main settings:

- `TOKEN`: Discord bot token.
- `CLIENT_ID`: Discord application ID.
- `GUILD_ID`: command registration server, optional but recommended during development.
- `GEMINI_API_KEY`: AI chat key.
- `AI_SERVICE_URL`: AI service endpoint, default `http://localhost:5000`.
- `TTS_LANG`: TTS language, default `it`.
- `TTS_SLOW`: TTS speech speed.
- `PRESENCE_STATUS`: bot presence status.
- `ACTIVITY_TYPE`: presence activity type.
- `ACTIVITY_TEXT`: presence activity text.
- `STAFF_ROLE_ID`: staff role used by the ticket system.

## Technical Notes

- The command loader also scans nested files inside `core/src/commands/`.
- The bot also listens for messages, reactions, modals, and select menus.
- Ticket transcripts are saved in `core/data/tickets/transcripts/`.

## License

This project is distributed under the AGPL license. See [LICENSE](LICENSE) for details.

## Support

If you find a problem, open an issue in the repository.

---

LegoChris Bot V2 © 2026