const readerStateByGuild = new Map();

function enableReader(guildId, voiceChannelId) {
    readerStateByGuild.set(String(guildId), {
        enabled: true,
        voiceChannelId: String(voiceChannelId),
        lastSpeakerId: null
    });
}

function disableReader(guildId) {
    return readerStateByGuild.delete(String(guildId));
}

function getReaderState(guildId) {
    return readerStateByGuild.get(String(guildId)) || null;
}

function setLastSpeakerId(guildId, userId) {
    const state = getReaderState(guildId);
    if (!state) {
        return null;
    }

    state.lastSpeakerId = userId ? String(userId) : null;
    return state.lastSpeakerId;
}

function isReaderEnabled(guildId) {
    return Boolean(readerStateByGuild.get(String(guildId))?.enabled);
}

module.exports = {
    enableReader,
    disableReader,
    getReaderState,
    setLastSpeakerId,
    isReaderEnabled
};
