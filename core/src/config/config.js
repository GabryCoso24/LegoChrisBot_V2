// config/config.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,

    guildId: process.env.GUILD_ID,

    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5000',
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    geminiFallbackModels: process.env.GEMINI_FALLBACK_MODELS || '',
    geminiRetries: Number(process.env.GEMINI_RETRIES || 3),
    ttsLang: process.env.TTS_LANG || 'it',
    ttsSlow: String(process.env.TTS_SLOW || 'false').toLowerCase() === 'true',
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || null,
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || null,
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    botName: process.env.BOT_NAME || 'LegoChrisBot',

    presenceStatus: process.env.PRESENCE_STATUS || 'online',
    activityType: process.env.ACTIVITY_TYPE || 'WATCHING',
    activityText: process.env.ACTIVITY_TEXT || '🧱 | I Mattoncini di LegoChris',

    staffRoleId: process.env.STAFF_ROLE_ID || null,
    highStaffRoleId: process.env.HIGH_STAFF_ROLE_ID || null,

    prefix: "!",

    logLevel: "info"
};