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
HIGH_STAFF_ROLE_ID=
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

Below is the complete list of active slash commands, including usage and access rules.

### Permissions: Who Can Use What

- Everyone: any server member.
- Staff: users with the role configured in `STAFF_ROLE_ID`.
- High Staff: users with the role configured in `HIGH_STAFF_ROLE_ID`.
- Discord permissions: some commands also require native Discord permissions (for example, `Ban Members`, `Manage Messages`).

Important: when a command has both a Discord permission requirement and a Staff/High Staff role check, both must pass.

### Moderation

#### `/ban`
Who can use it: Staff + `Ban Members`

- `/ban user utente:<utente> [motivo:<testo>]`

Example:

```text
/ban user utente:@User motivo:Spam
```

#### `/mute`
Who can use it: Staff + `Moderate Members` (plus voice mute handling)

- `/mute text utente:<utente> durata:<durata> [motivo:<testo>]`
- `/mute voice utente:<utente> durata:<durata> [motivo:<testo>]`

Supported duration format: `1d2h30m`, `45m`, `10s`, `2w`.

#### `/timeout`
Who can use it: Staff + `Moderate Members`

- `/timeout utente:<utente> durata:<durata> [motivo:<testo>]`

Applies text timeout and, if the user is in voice, voice mute as well.

#### `/unmute`
Who can use it: Staff + `Moderate Members`

- `/unmute text utente:<utente> [motivo:<testo>]`
- `/unmute voice utente:<utente> [motivo:<testo>]`

#### `/untimeout`
Who can use it: Staff + `Moderate Members`

- `/untimeout utente:<utente> [motivo:<testo>]`

Removes both text timeout and voice mute.

#### `/unban`
Who can use it: Staff + `Ban Members`

- `/unban user_id:<id_utente> [motivo:<testo>]`

#### `/tempban`
Who can use it: Staff + `Ban Members`

- `/tempban add utente:<utente> durata:<durata> [motivo:<testo>]`
- `/tempban modify user_id:<id_utente> durata:<durata>`
- `/tempban remove user_id:<id_utente>`
- `/tempban list`

Manages temporary bans with automatic expiration.

#### `/purge`
Who can use it: Staff + `Manage Messages`

Available subcommands:

- `/purge all`
- `/purge any [count:<1-1000>]`
- `/purge bots [count:<1-1000>]`
- `/purge humans [count:<1-1000>]`
- `/purge embeds [count:<1-1000>]`
- `/purge images [count:<1-1000>]`
- `/purge links [count:<1-1000>]`
- `/purge invites [count:<1-1000>]`
- `/purge mentions [count:<1-1000>]`
- `/purge text [count:<1-1000>]`
- `/purge user utente:<utente> [count:<1-1000>]`
- `/purge match text:<testo> [count:<1-1000>]`
- `/purge not text:<testo> [count:<1-1000>]`
- `/purge startswith text:<testo> [count:<1-1000>]`
- `/purge endswith text:<testo> [count:<1-1000>]`
- `/purge after message:<id_o_link> [count:<1-1000>]`
- `/purge periodo periodo_di_tempo:<durata>`
- `/purge fino_a data:<YYYY-MM-DD oppure YYYY-MM-DD HH:mm>`

#### `/rules`
Who can use it: Staff + `Manage Server`

- `/rules add tipo:<staff|team|server> testo:<testo>`
- `/rules remove tipo:<staff|team|server> indice:<numero>`
- `/rules edit tipo:<staff|team|server> indice:<numero> testo:<testo>`
- `/rules create tipo:<staff|team|server> testo:<multilinea_o_separato_da_|>`
- `/rules list tipo:<staff|team|server>`
- `/rules send tipo:<staff|team|server> canale:<canale_testo> [titolo:<titolo>]`

### Utility and Community

#### `/ai`
Who can use it: Everyone

- `/ai join`
- `/ai mode`

Typical usage:

```text
/ai join
/ai mode
```

#### `/tts`
Who can use it: Everyone

- `/tts text testo:<testo>`
- `/tts join`
- `/tts mode`
- `/tts leave`
- `/tts status`

Typical usage:

```text
/tts text testo:Ciao a tutti
/tts join
/tts mode
/tts status
/tts leave
```

#### `/soundboard`
Who can use it: Everyone

- `/soundboard playsound nome:<nome_suono> [canale:<canale_vocale>]`
- `/soundboard skip`
- `/soundboard stop`
- `/soundboard queue`
- `/soundboard listsounds`

Audio files must be stored in `core/data/soundboard/`.

#### `/fun`
Who can use it: Everyone

- `/fun coinflip scelta:<testa|croce>`
- `/fun randomfact`
- `/fun rps scelta:<sasso|carta|forbici>`

#### `/profile`
Who can use it: Everyone

- `/profile userinfo [utente:<utente>]`
- `/profile id utente:<utente>`

#### `/message`
Who can use it: Staff

- `/message tipo:<reaction_roles> canale:<canale_testo>`

At the moment, the only available type is `reaction_roles`.

#### `/reactionrole`
Who can use it: Staff

- `/reactionrole set message_id:<id_messaggio> emoji:<emoji> role:<ruolo>`
- `/reactionrole remove message_id:<id_messaggio> emoji:<emoji>`

Technical requirement: the bot must have the Discord `Manage Roles` permission.

#### `/roles`
Who can use it: High Staff + `Manage Roles`

- `/roles add ruoli:<menzioni_ruoli> [membro:<utente>] [tutti:<true|false>]`
- `/roles remove membro:<utente> ruolo:<ruolo>`

`add` supports bulk assignment or single-user assignment.

#### `/talent`
Who can use it: High Staff

- `/talent register utente:<utente> ruolo:<host|judge|participant> [anche_giudice:<true|false>]`
- `/talent add_points utente:<utente> punti:<numero>`
- `/talent edit_role utente:<utente> ruolo:<host|judge|participant> [anche_giudice:<true|false>]`
- `/talent leaderboard`
- `/talent list`

Note: `add_points` also has an internal check (judge/host with judge permission/admin), in addition to the High Staff check.

#### `/ticket`
Who can use it:

- `setup`: High Staff
- `claim`, `close`, `old_add`, `old_add_all`: Staff

Subcommands:

- `/ticket setup [canale:<canale_testo>]`
- `/ticket claim [canale:<canale_testo>]`
- `/ticket close reason:<motivo> [canale:<canale_testo>]`
- `/ticket old_add canale:<canale_testo>`
- `/ticket old_add_all [categoria:<categoria>]`

`claim` and `close` can also be used from outside the ticket channel by specifying `canale`.

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
- `HIGH_STAFF_ROLE_ID`: high staff role used by high privilege commands (roles, talent, ticket setup).

## Technical Notes

- The command loader also scans nested files inside `core/src/commands/`.
- The bot also listens for messages, reactions, modals, and select menus.
- Ticket transcripts are saved in `core/data/tickets/transcripts/`.

## License

This project is distributed under the AGPL license. See [LICENSE](LICENSE) for details.

## Support

If you find a problem, open an issue in the repository.

---

LegoChris Bot V2 © 2026 by gabrycoso