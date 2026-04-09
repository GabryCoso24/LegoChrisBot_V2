const { EmbedBuilder } = require('discord.js');
const { AsyncLocalStorage } = require('node:async_hooks');

const embedContext = new AsyncLocalStorage();

function runWithEmbedContext(context, callback) {
    return embedContext.run(context, callback);
}

function normalizeFields(fields) {
    if (!Array.isArray(fields)) return [];

    return fields
        .map(field => {
            if (!field || typeof field !== 'object') return null;

            const name = field.name == null ? null : String(field.name);
            const value = field.value == null ? null : String(field.value);
            if (!name || !value) return null;

            return {
                name,
                value,
                inline: Boolean(field.inline)
            };
        })
        .filter(Boolean);
}

function buildResponseEmbed({ title, description, fields = [], color = 0xff7900, thumbnail = null } = {}) {
    const context = embedContext.getStore();
    const resolvedThumbnail = thumbnail || context?.guildIconUrl || null;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setFooter({ text: 'LegoChris Bot' })
        .setTimestamp();

    if (resolvedThumbnail) {
        embed.setThumbnail(resolvedThumbnail);
    }

    if (title) {
        embed.setTitle(title);
    }

    if (description) {
        embed.setDescription(description);
    }

    const normalizedFields = normalizeFields(fields);
    if (normalizedFields.length > 0) {
        embed.addFields(normalizedFields);
    }

    return embed;
}

module.exports = {
    buildResponseEmbed,
    runWithEmbedContext
};
