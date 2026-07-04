const { getReaderState, setLastSpeakerId } = require('./ttsReaderState');
const { enqueueTtsPlayback } = require('../ai/ttsPlaybackQueue');

function isMutedInVoice(member) {
    return Boolean(member?.voice?.selfMute || member?.voice?.serverMute);
}

function sanitizeForSpeech(text) {
    return String(text || '')
        .replace(/https?:\/\/\S+/gi, 'link')
        .trim();
}

async function handleTtsMessage(message) {
    if (!message.guild || message.author.bot || !message.content?.trim()) {
        return;
    }

    const state = getReaderState(message.guild.id);
    if (!state?.enabled || !state.voiceChannelId) {
        return;
    }

    const member = message.member;
    if (!member?.voice?.channelId || member.voice.channelId !== state.voiceChannelId) {
        return;
    }

    if (!isMutedInVoice(member)) {
        return;
    }

    const cleanMessage = sanitizeForSpeech(message.content).slice(0, 220);
    if (!cleanMessage) {
        return;
    }

    const shouldAnnounceSpeaker = state.lastSpeakerId !== String(message.author.id);
    const textForSpeech = shouldAnnounceSpeaker
        ? `${member.displayName} dice: ${cleanMessage}`
        : cleanMessage;

    setLastSpeakerId(message.guild.id, message.author.id);

    enqueueTtsPlayback({
        guild: message.guild,
        voiceChannel: member.voice.channel,
        text: textForSpeech,
        source: 'classic'
    });
}

module.exports = {
    handleTtsMessage
};
