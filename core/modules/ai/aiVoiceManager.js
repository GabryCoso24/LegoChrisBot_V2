const fs = require('node:fs/promises');
const path = require('node:path');
const prism = require('prism-media');
const ffmpegPath = require('ffmpeg-static');
const {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType
} = require('@discordjs/voice');

const guildStates = new Map();
const tempDir = path.resolve(process.cwd(), 'data', 'ai', 'tts');

function getState(guildId) {
    if (!guildStates.has(guildId)) {
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        });

        const state = {
            connection: null,
            player,
            currentChannelId: null
        };

        player.on(AudioPlayerStatus.Idle, () => {
            state.currentChannelId = state.connection?.joinConfig?.channelId || state.currentChannelId;
        });

        player.on('error', error => {
            console.error(`Errore TTS voice player per guild ${guildId}:`, error);
        });

        guildStates.set(guildId, state);
    }

    return guildStates.get(guildId);
}

async function connectToChannel(interaction, channel) {
    const guildId = interaction.guildId;
    const state = getState(guildId);
    const adapterCreator = interaction.voiceAdapterCreator || interaction.guild?.voiceAdapterCreator;

    if (state.connection && state.connection.joinConfig.channelId !== channel.id) {
        state.connection.destroy();
        state.connection = null;
    }

    if (!state.connection) {
        state.connection = joinVoiceChannel({
            channelId: channel.id,
            guildId,
            adapterCreator,
            selfDeaf: true
        });

        state.connection.subscribe(state.player);
        state.currentChannelId = channel.id;
        await entersState(state.connection, VoiceConnectionStatus.Ready, 20_000);
    }

    return state;
}

async function playTtsBuffer(interaction, channel, audioBase64, fileName) {
    const state = await connectToChannel(interaction, channel);
    await fs.mkdir(tempDir, { recursive: true });

    const tempFilePath = path.join(tempDir, fileName);
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await fs.writeFile(tempFilePath, audioBuffer);

    try {
        while (state.player.state.status === AudioPlayerStatus.Playing || state.player.state.status === AudioPlayerStatus.Buffering) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const ffmpeg = new prism.FFmpeg({
            args: [
                '-hide_banner',
                '-loglevel', 'error',
                '-i', tempFilePath,
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2'
            ],
            exec: ffmpegPath
        });

        const resource = createAudioResource(ffmpeg, {
            inputType: StreamType.Raw
        });

        state.player.play(resource);

        while (state.player.state.status === AudioPlayerStatus.Playing || state.player.state.status === AudioPlayerStatus.Buffering) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } finally {
        await fs.unlink(tempFilePath).catch(() => null);
    }
}

function disconnect(guildId) {
    const state = guildStates.get(guildId);
    if (!state) {
        return false;
    }

    if (state.connection) {
        state.connection.destroy();
        state.connection = null;
    }

    state.currentChannelId = null;
    state.player.stop(true);
    return true;
}

function getConnectedChannelId(guildId) {
    return guildStates.get(guildId)?.currentChannelId || null;
}

module.exports = {
    connectToChannel,
    playTtsBuffer,
    disconnect,
    getConnectedChannelId
};
