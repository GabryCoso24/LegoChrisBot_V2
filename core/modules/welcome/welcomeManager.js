const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_BANNER_PATH = path.resolve(process.cwd(), 'data', 'welcome', 'Benvenuto_MT.png');
const { EmbedBuilder } = require('discord.js');

const DATA_PATH = path.resolve(process.cwd(), 'data', 'welcome', 'welcome.json');

const DEFAULT_CONFIG = {
    channelId: null,
    mentionChannelId: null,
    enabled: true,
    embed: {
        title: 'Benvenuto, {user}! 👋',
        description: 'Sei il membro numero **{memberCount}** di **{server}**!\nSperiamo che tu ti trovi bene qui! 🧱',
        color: 0xff7900,
        imageUrl: null,
        thumbnailUrl: null,
        footerText: null,
        fields: []
    }
};

// ===== I/O helpers =====

function loadConfig() {
    try {
        if (!fs.existsSync(DATA_PATH)) return { ...DEFAULT_CONFIG, embed: { ...DEFAULT_CONFIG.embed } };
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            mentionChannelId: parsed.mentionChannelId ?? null,
            embed: { ...DEFAULT_CONFIG.embed, ...(parsed.embed ?? {}) }
        };
    } catch (err) {
        console.error('[WelcomeManager] Errore nel caricamento della config:', err);
        return { ...DEFAULT_CONFIG, embed: { ...DEFAULT_CONFIG.embed } };
    }
}

async function saveConfig(config) {
    await fsp.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fsp.writeFile(DATA_PATH, JSON.stringify(config, null, 2), 'utf8');
}

// ===== Placeholder resolver =====

function resolvePlaceholders(text, member, config) {
    if (!text) return text;
    const canaleMention = config?.mentionChannelId ? `<#${config.mentionChannelId}>` : '';
    return text
        .replace(/\{user\}/g, `${member}`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{memberCount\}/g, String(member.guild.memberCount))
        .replace(/\{canale\}/g, canaleMention);
}

// ===== Build embed =====

function buildWelcomeEmbed(embedCfg, member, config) {
    const embed = new EmbedBuilder()
        .setColor(embedCfg.color ?? 0xff7900)
        .setTimestamp();

    const title = resolvePlaceholders(embedCfg.title, member, config);
    const description = resolvePlaceholders(embedCfg.description, member, config);
    const footerText = resolvePlaceholders(embedCfg.footerText, member, config);

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (footerText) embed.setFooter({ text: footerText });
    else embed.setFooter({ text: 'LegoChris Bot' });

    const thumbnailUrl = embedCfg.thumbnailUrl || member.guild.iconURL({ dynamic: true, size: 512 });
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

    if (embedCfg.imageUrl) embed.setImage(embedCfg.imageUrl);

    if (Array.isArray(embedCfg.fields) && embedCfg.fields.length > 0) {
        const resolvedFields = embedCfg.fields
            .filter(f => f?.name && f?.value)
            .map(f => ({
                name: resolvePlaceholders(f.name, member, config),
                value: resolvePlaceholders(f.value, member, config),
                inline: Boolean(f.inline)
            }));
        if (resolvedFields.length > 0) embed.addFields(resolvedFields);
    }

    return embed;
}

// ===== Main handler =====

async function handleMemberJoin(member) {
    const config = loadConfig();

    if (!config.enabled) return;
    if (!config.channelId) return;

    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;

    const embed = buildWelcomeEmbed(config.embed, member, config);
    const payload = { embeds: [embed] };

    // Se non è configurata un'immagine custom, usa il banner default
    if (!config.embed.imageUrl && fs.existsSync(DEFAULT_BANNER_PATH)) {
        payload.files = [DEFAULT_BANNER_PATH];
        embed.setImage('attachment://Benvenuto_MT.png');
    }

    await channel.send(payload).catch(err => {
        console.error('[WelcomeManager] Errore nell\'invio del welcome:', err);
    });
}

// ===== Config management functions (used by slash command) =====

function getConfig() {
    return loadConfig();
}

async function setChannel(channelId) {
    const config = loadConfig();
    config.channelId = channelId;
    await saveConfig(config);
}

async function setEnabled(enabled) {
    const config = loadConfig();
    config.enabled = enabled;
    await saveConfig(config);
}

async function setEmbedField(field, value) {
    const config = loadConfig();
    config.embed[field] = value;
    await saveConfig(config);
}

async function resetConfig() {
    const fresh = { ...DEFAULT_CONFIG, embed: { ...DEFAULT_CONFIG.embed } };
    await saveConfig(fresh);
    return fresh;
}

async function setMentionChannel(channelId) {
    const config = loadConfig();
    config.mentionChannelId = channelId;
    await saveConfig(config);
}

module.exports = {
    handleMemberJoin,
    getConfig,
    setChannel,
    setEnabled,
    setEmbedField,
    resetConfig,
    buildWelcomeEmbed,
    resolvePlaceholders,
    setMentionChannel
};
