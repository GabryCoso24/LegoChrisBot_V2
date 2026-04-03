const ttsEnabledGuilds = new Set();

function enableTts(guildId) {
    ttsEnabledGuilds.add(guildId);
}

function disableTts(guildId) {
    ttsEnabledGuilds.delete(guildId);
}

function isTtsEnabled(guildId) {
    return ttsEnabledGuilds.has(guildId);
}

module.exports = {
    enableTts,
    disableTts,
    isTtsEnabled
};
