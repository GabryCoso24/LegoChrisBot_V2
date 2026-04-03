const fs = require('fs');
const path = require('path');
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
    StreamType,
} = require('@discordjs/voice');

const soundboardDir = path.resolve(__dirname, '../../data/soundboard');
const hiddenSounds = new Set(['mark whatsapp']);
const allowedExtensions = ['.mp3', '.wav'];
const guildStates = new Map();

function getState(guildId) {
    if (!guildStates.has(guildId)) {
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            },
        });

        const state = {
            connection: null,
            player,
            queue: [],
            currentTrack: null,
        };

        player.on(AudioPlayerStatus.Idle, () => {
            state.currentTrack = null;
            void playNext(guildId);
        });

        player.on('error', error => {
            state.currentTrack = null;
            console.error(`Audio player error for guild ${guildId}:`, error);
            void playNext(guildId);
        });

        guildStates.set(guildId, state);
    }

    return guildStates.get(guildId);
}

function resolveSoundFile(soundName) {
    const normalized = stripExtension(soundName);
    for (const extension of allowedExtensions) {
        const candidate = path.join(soundboardDir, `${normalized}${extension}`);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

function listSounds() {
    if (!fs.existsSync(soundboardDir)) {
        return [];
    }

    return fs.readdirSync(soundboardDir)
        .filter(file => fs.statSync(path.join(soundboardDir, file)).isFile())
        .map(file => {
            const extension = path.extname(file).toLowerCase();
            if (!allowedExtensions.includes(extension)) {
                return null;
            }
            return stripExtension(file);
        })
        .filter(Boolean)
        .filter(name => !hiddenSounds.has(name.toLowerCase()))
        .sort((left, right) => left.localeCompare(right, 'it'));
}

function stripExtension(name) {
    return name.replace(/\.(mp3|wav)$/i, '');
}

async function connectToChannel(interaction, channel) {
    const guildId = interaction.guildId;
    const state = getState(guildId);

    if (state.connection && state.connection.joinConfig.channelId !== channel.id) {
        state.connection.destroy();
        state.connection = null;
    }

    if (!state.connection) {
        state.connection = joinVoiceChannel({
            channelId: channel.id,
            guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        state.connection.subscribe(state.player);

        await entersState(state.connection, VoiceConnectionStatus.Ready, 20_000);
    }

    return state;
}

async function queueSound(interaction, soundName, targetChannel) {
    const soundFile = resolveSoundFile(soundName);
    if (!soundFile) {
        throw new Error(`File non trovato: ${stripExtension(soundName)}`);
    }

    const channel = targetChannel || interaction.member?.voice?.channel;
    if (!channel) {
        throw new Error('Devi essere in un canale vocale, oppure specificare un canale.');
    }

    const state = await connectToChannel(interaction, channel);
    const track = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: stripExtension(soundName),
        filePath: soundFile,
        requestedBy: interaction.user.username,
    };

    state.queue.push(track);

    if (state.player.state.status !== AudioPlayerStatus.Playing && state.player.state.status !== AudioPlayerStatus.Buffering) {
        void playNext(interaction.guildId);
    }

    return track;
}

async function playNext(guildId) {
    const state = guildStates.get(guildId);
    if (!state) {
        return;
    }

    if (state.currentTrack) {
        return;
    }

    const nextTrack = state.queue.shift();
    if (!nextTrack) {
        if (state.connection) {
            state.connection.destroy();
            state.connection = null;
        }
        return;
    }

    state.currentTrack = nextTrack;

    const ffmpeg = new prism.FFmpeg({
        args: [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', nextTrack.filePath,
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
        ],
        exec: ffmpegPath,
    });

    const resource = createAudioResource(ffmpeg, {
        inputType: StreamType.Raw,
        inlineVolume: false,
    });

    state.player.play(resource);
}

function skip(guildId) {
    const state = guildStates.get(guildId);
    if (!state || state.player.state.status === AudioPlayerStatus.Idle) {
        return false;
    }

    state.player.stop(true);
    return true;
}

function stop(guildId) {
    const state = guildStates.get(guildId);
    if (!state) {
        return false;
    }

    state.queue = [];
    state.currentTrack = null;
    state.player.stop(true);

    if (state.connection) {
        state.connection.destroy();
        state.connection = null;
    }

    return true;
}

function queue(guildId) {
    const state = guildStates.get(guildId);
    return {
        nowPlaying: state?.currentTrack || null,
        pending: state ? [...state.queue] : [],
    };
}

module.exports = {
    listSounds,
    queueSound,
    skip,
    stop,
    queue,
};