// config/config.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,

    guildId: process.env.GUILD_ID,

    aiServiceUrl: process.env.AI_SERVICE_URL,
    audioServiceUrl: process.env.AUDIO_SERVICE_URL,

    presenceStatus: process.env.PRESENCE_STATUS || 'online',
    activityType: process.env.ACTIVITY_TYPE || 'WATCHING',
    activityText: process.env.ACTIVITY_TEXT || '🧱 | I Mattoncini di LegoChris',

    staffRoleId: process.env.STAFF_ROLE_ID || null,

    prefix: "!",

    logLevel: "info"
};