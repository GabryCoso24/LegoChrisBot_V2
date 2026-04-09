const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_PATH = path.resolve(process.cwd(), 'data/moderation/voice_mutes.json');

const runtime = {
    initialized: false,
    activeMutes: new Map()
};

async function readJson(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

async function persistState() {
    const payload = { mutes: {} };

    for (const [key, info] of runtime.activeMutes.entries()) {
        payload.mutes[key] = {
            guildId: info.guildId,
            userId: info.userId,
            endTime: info.endTime.toISOString(),
            reason: info.reason,
            moderatorTag: info.moderatorTag
        };
    }

    await writeJson(DATA_PATH, payload);
}

async function releaseMute(client, guildId, userId) {
    const key = getKey(guildId, userId);
    const existing = runtime.activeMutes.get(key);
    if (!existing) return false;

    if (existing.timeoutHandle) {
        clearTimeout(existing.timeoutHandle);
    }

    runtime.activeMutes.delete(key);

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member?.voice?.channel) {
            await member.voice.setMute(false, 'Voice mute terminato').catch(() => null);
        }
    }

    await persistState();
    return true;
}

function scheduleRelease(client, guildId, userId, endTime, reason, moderatorTag) {
    const key = getKey(guildId, userId);
    const existing = runtime.activeMutes.get(key);
    if (existing?.timeoutHandle) {
        clearTimeout(existing.timeoutHandle);
    }

    const delay = Math.max(endTime.getTime() - Date.now(), 0);
    const timeoutHandle = setTimeout(async () => {
        try {
            await releaseMute(client, guildId, userId);
        } catch {
            runtime.activeMutes.delete(key);
            await persistState().catch(() => null);
        }
    }, delay);

    runtime.activeMutes.set(key, {
        guildId,
        userId,
        endTime,
        reason,
        moderatorTag,
        timeoutHandle
    });
}

async function initialize(client) {
    if (runtime.initialized) return;

    const saved = await readJson(DATA_PATH, { mutes: {} });
    const now = Date.now();

    for (const raw of Object.values(saved.mutes || {})) {
        const guildId = String(raw.guildId || '');
        const userId = String(raw.userId || '');
        const endTime = new Date(raw.endTime);

        if (!guildId || !userId || Number.isNaN(endTime.getTime())) {
            continue;
        }

        if (endTime.getTime() <= now) {
            await releaseMute(client, guildId, userId).catch(() => null);
            continue;
        }

        scheduleRelease(client, guildId, userId, endTime, raw.reason || 'Nessun motivo fornito', raw.moderatorTag || 'system');
    }

    await persistState();
    runtime.initialized = true;
}

async function applyVoiceMute(client, member, durationMs, reason, moderatorTag) {
    const endTime = new Date(Date.now() + durationMs);
    await member.voice.setMute(true, `${reason} | By ${moderatorTag}`);
    scheduleRelease(client, member.guild.id, member.id, endTime, reason, moderatorTag);
    await persistState();
    return endTime;
}

function getActiveMute(client, guildId, userId) {
    const key = getKey(guildId, userId);
    return runtime.activeMutes.get(key) || null;
}

module.exports = {
    initialize,
    applyVoiceMute,
    releaseMute,
    getActiveMute
};
