const { generateTts } = require('./aiServiceClient');
const { playTtsBuffer } = require('./aiVoiceManager');

const queuesByGuild = new Map();
let sequence = 0;

const sourcePriority = {
    classic: 0,
    ai: 1
};

function getOrCreateGuildQueue(guildId) {
    const key = String(guildId);
    if (!queuesByGuild.has(key)) {
        queuesByGuild.set(key, {
            running: false,
            jobs: []
        });
    }

    return queuesByGuild.get(key);
}

function compareJobs(left, right) {
    const leftPriority = sourcePriority[left.source] ?? 99;
    const rightPriority = sourcePriority[right.source] ?? 99;

    if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
    }

    return left.seq - right.seq;
}

async function resolveMentionName(guild, userId) {
    if (!guild || !userId) {
        return 'utente';
    }

    const cached = guild.members?.cache?.get(String(userId));
    if (cached) {
        return cached.displayName || cached.user?.username || 'utente';
    }

    const fetched = await guild.members.fetch(String(userId)).catch(() => null);
    if (!fetched) {
        return 'utente';
    }

    return fetched.displayName || fetched.user?.username || 'utente';
}

async function resolveRoleName(guild, roleId) {
    if (!guild || !roleId) {
        return 'ruolo';
    }

    const cached = guild.roles?.cache?.get(String(roleId));
    if (cached) {
        return cached.name || 'ruolo';
    }

    const fetched = await guild.roles.fetch(String(roleId)).catch(() => null);
    if (!fetched) {
        return 'ruolo';
    }

    return fetched.name || 'ruolo';
}

async function resolveChannelName(guild, channelId) {
    if (!guild || !channelId) {
        return 'canale';
    }

    const cached = guild.channels?.cache?.get(String(channelId));
    if (cached) {
        return cached.name || 'canale';
    }

    const fetched = await guild.channels.fetch(String(channelId)).catch(() => null);
    if (!fetched) {
        return 'canale';
    }

    return fetched.name || 'canale';
}

async function normalizeSpeechText(guild, text) {
    let output = String(text || '');
    const userIds = [...new Set([...output.matchAll(/<@!?(\d+)>/g)].map(match => match[1]))];
    const roleIds = [...new Set([...output.matchAll(/<@&(\d+)>/g)].map(match => match[1]))];
    const channelIds = [...new Set([...output.matchAll(/<#(\d+)>/g)].map(match => match[1]))];

    for (const userId of userIds) {
        const name = await resolveMentionName(guild, userId);
        const pattern = new RegExp(`<@!?${userId}>`, 'g');
        output = output.replace(pattern, name);
    }

    for (const roleId of roleIds) {
        const name = await resolveRoleName(guild, roleId);
        const pattern = new RegExp(`<@&${roleId}>`, 'g');
        output = output.replace(pattern, `ruolo ${name}`);
    }

    for (const channelId of channelIds) {
        const name = await resolveChannelName(guild, channelId);
        const pattern = new RegExp(`<#${channelId}>`, 'g');
        output = output.replace(pattern, `canale ${name}`);
    }

    return output.replace(/\s+/g, ' ').trim();
}

async function runNext(guildId) {
    const queue = getOrCreateGuildQueue(guildId);
    if (queue.running) {
        return;
    }

    const nextJob = queue.jobs.shift();
    if (!nextJob) {
        return;
    }

    queue.running = true;

    try {
        const normalizedText = await normalizeSpeechText(nextJob.guild, nextJob.text);
        const tts = await generateTts(normalizedText);
        await playTtsBuffer(
            {
                guildId: nextJob.guild.id,
                guild: nextJob.guild,
                voiceAdapterCreator: nextJob.guild.voiceAdapterCreator
            },
            nextJob.voiceChannel,
            tts.audio_base64,
            tts.file_name
        );
    } catch (error) {
        console.error(`[TTS Queue][${guildId}] ${error.message}`);
    } finally {
        queue.running = false;
        if (queue.jobs.length > 0) {
            void runNext(guildId);
        }
    }
}

function enqueueTtsPlayback({ guild, voiceChannel, text, source = 'classic' }) {
    if (!guild || !voiceChannel || !text) {
        return;
    }

    const guildId = guild.id;
    const queue = getOrCreateGuildQueue(guildId);
    queue.jobs.push({
        guild,
        voiceChannel,
        text,
        source,
        seq: sequence++
    });
    queue.jobs.sort(compareJobs);

    void runNext(guildId);
}

module.exports = {
    enqueueTtsPlayback
};
