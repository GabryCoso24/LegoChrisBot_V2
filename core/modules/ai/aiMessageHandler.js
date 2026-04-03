const { chat } = require('./aiServiceClient');
const { isTtsEnabled } = require('./aiState');
const { getConnectedChannelId } = require('./aiVoiceManager');
const { enqueueTtsPlayback } = require('./ttsPlaybackQueue');

async function handleAiMessage(message) {
    if (!message.guild || message.author.bot) {
        return;
    }

    const botId = message.client.user.id;
    if (!message.mentions.users.has(botId)) {
        return;
    }

    if (!isTtsEnabled(message.guild.id)) {
        return;
    }

    const connectedChannelId = getConnectedChannelId(message.guild.id);
    const voiceChannel = connectedChannelId ? message.guild.channels.cache.get(connectedChannelId) : null;
    if (!voiceChannel) {
        return;
    }

    let response;
    try {
        response = await chat(
            message.guild.id,
            message.author.id,
            message.author.username,
            message.content,
            botId
        );
    } catch (error) {
        await message.reply(`Servizio AI momentaneamente non disponibile: ${error.message}`);
        return;
    }

    if (!response?.reply) {
        return;
    }

    await message.reply(response.reply);

    if (response.kind !== 'response') {
        return;
    }

    const botSpokenName = message.guild.members.me?.displayName || message.client.user.username || 'Bot';

    enqueueTtsPlayback({
        guild: message.guild,
        voiceChannel,
        text: `${botSpokenName} dice: ${response.reply}`,
        source: 'ai'
    });
}

module.exports = {
    handleAiMessage
};
