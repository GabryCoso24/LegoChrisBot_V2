const readerStateByGuild = new Map();

function enableReader(guildId, voiceChannelId) {
    readerStateByGuild.set(String(guildId), {
        enabled: true,
        voiceChannelId: String(voiceChannelId)
    });
}

function disableReader(guildId) {
    return readerStateByGuild.delete(String(guildId));
}

function getReaderState(guildId) {
    return readerStateByGuild.get(String(guildId)) || null;
}

function isReaderEnabled(guildId) {
    return Boolean(readerStateByGuild.get(String(guildId))?.enabled);
}

module.exports = {
    enableReader,
    disableReader,
    getReaderState,
    isReaderEnabled
};
