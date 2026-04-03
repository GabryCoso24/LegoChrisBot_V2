# LegoChris Bot V2

A complete Discord bot with AI, TTS (Text-to-Speech), ticket management, and reaction roles features.

## 🎯 Features

- **AI Chat**: Reply to messages mentioning the bot with intelligent AI (Gemini 1.5 Flash)
- **Classic TTS**: Automatically read messages from muted users in voice channels
- **AI TTS**: Voice responses from the AI in voice channels
- **TTS Queue**: Queue system for ordered playback (classic → AI)
- **Ticket System**: Create and manage support tickets with transcriptions
- **Reaction Roles**: Assign roles through message reactions
- **Soundboard**: Play sounds in voice channels

## 📋 Requirements

- Node.js 18+
- Discord Bot Token
- Gemini API Key (for AI functionality)
- Google TTS API (included automatically)

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/GabryCoso24/LegoChrisBot_V2.git
cd LegoChrisBot_V2
```

### 2. Install dependencies

```bash
cd core
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp src/config/.env.example src/config/.env
```

Edit `src/config/.env` with your credentials:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
GEMINI_RETRIES=3

TTS_LANG=it
TTS_SLOW=false

PRESENCE_STATUS=dnd
ACTIVITY_TEXT=Bot status
```

### 4. Start the bot

```bash
node src/index.js
```

## 📁 Project Structure

```
core/
├── src/
│   ├── index.js                 # Bot entry point
│   ├── commands/                # Slash commands
│   ├── config/
│   │   ├── config.js            # Configuration from .env
│   │   └── .env                 # Environment variables
│   ├── lib/                     # Utility functions
│   └── services/
├── modules/
│   ├── ai/                      # AI modules
│   │   ├── aiServiceClient.js   # Gemini chat and TTS
│   │   ├── aiMessageHandler.js  # AI chat handler
│   │   ├── aiVoiceManager.js    # Discord voice management
│   │   ├── aiState.js           # AI state per guild
│   │   └── ttsPlaybackQueue.js  # Shared TTS queue
│   ├── ttsClassic/              # Classic TTS modules
│   │   ├── ttsMessageHandler.js # Muted users reader handler
│   │   └── ttsReaderState.js    # Reader state per guild
│   ├── tickets/                 # Ticket system
│   ├── reactionRoles/           # Reaction roles
│   └── soundboard/              # Soundboard
└── data/
    ├── ai/                      # AI data (memories, aliases, contexts)
    ├── tickets/                 # Ticket data
    └── soundboard/              # Audio files
```

## 🛠️ Available Commands

### `/ai` - AI Assistant
- `/ai join` - Bot joins voice channel, activates AI TTS
- `/ai mode` - Toggle AI TTS mode (when already in voice)

### `/tts` - Classic Text-to-Speech
- `/tts text <msg>` - Generate audio file from text
- `/tts join` - Bot joins voice channel, activates reader
- `/tts mode` - Toggle reader mode (when already in voice)
- `/tts leave` - Bot leaves voice channel
- `/tts status` - Show reader status

### Regular Chat
Mention the bot (`@LegoChris`) in a message to get an AI response in chat + voice

## 🔧 Advanced Configuration

### AI State (`core/data/ai/state.json`)

Automatically persists:
- User memories
- Custom aliases
- Conversation contexts
- TTS settings per guild

### Retry Logic

The bot implements automatic retry with exponential backoff for:
- Gemini API errors (429, 503)
- Connection timeouts

Configurable in `src/config/config.js`:
- `GEMINI_RETRIES=3` (number of attempts)
- Backoff: 400ms × attempt number

## 📝 License

This project is distributed under the **AGPL** license. See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss the modifications.

## 📧 Support

For questions or issues, open an issue on GitHub.

---

**LegoChris Bot V2** © 2026 - Built with 🧱 by gabrycoso