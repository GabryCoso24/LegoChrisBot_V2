const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { hasStaffRole } = require('../../lib/permissions');

const BULK_DELETE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function buildPurgeEmbed(description, fields = []) {
    return buildResponseEmbed({
        title: 'Moderation - Purge',
        description,
        fields
    });
}

function parseDuration(duration) {
    const pattern = /(\d+)([smhdwMy])/g;
    const matches = [...String(duration || '').matchAll(pattern)];

    if (matches.length === 0) {
        return null;
    }

    let totalSeconds = 0;
    for (const match of matches) {
        const value = Number(match[1]);
        const unit = match[2];

        if (unit === 's') totalSeconds += value;
        else if (unit === 'm') totalSeconds += value * 60;
        else if (unit === 'h') totalSeconds += value * 3600;
        else if (unit === 'd') totalSeconds += value * 86400;
        else if (unit === 'w') totalSeconds += value * 604800;
        else if (unit === 'M') totalSeconds += value * 2592000;
        else if (unit === 'y') totalSeconds += value * 31536000;
    }

    return totalSeconds > 0 ? totalSeconds * 1000 : null;
}

function parseDateInput(value) {
    const input = String(value || '').trim();
    if (!input) {
        return null;
    }

    const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]) - 1;
        const day = Number(dateOnlyMatch[3]);
        const parsed = new Date(year, month, day, 23, 59, 59, 999);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const dateTimeMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (dateTimeMatch) {
        const year = Number(dateTimeMatch[1]);
        const month = Number(dateTimeMatch[2]) - 1;
        const day = Number(dateTimeMatch[3]);
        const hours = Number(dateTimeMatch[4]);
        const minutes = Number(dateTimeMatch[5]);
        const seconds = Number(dateTimeMatch[6] || 0);
        const parsed = new Date(year, month, day, hours, minutes, seconds, 0);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isBulkDeleteSafe(message) {
    return Date.now() - message.createdTimestamp < BULK_DELETE_WINDOW_MS;
}

async function fetchLastMessages(channel, amount) {
    const messages = [];
    let before;

    while (messages.length < amount) {
        const limit = Math.min(100, amount - messages.length);
        const batch = await channel.messages.fetch({
            limit,
            ...(before ? { before } : {})
        }).catch(() => null);

        if (!batch || batch.size === 0) {
            break;
        }

        const batchMessages = [...batch.values()];
        messages.push(...batchMessages);

        if (batch.size < limit) {
            break;
        }

        before = batchMessages[batchMessages.length - 1].id;
    }

    return messages.slice(0, amount);
}

async function fetchMessagesSince(channel, cutoffTimestamp) {
    const messages = [];
    let before;

    while (true) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {})
        }).catch(() => null);

        if (!batch || batch.size === 0) {
            break;
        }

        const batchMessages = [...batch.values()];

        for (const message of batchMessages) {
            if (message.createdTimestamp < cutoffTimestamp) {
                return messages;
            }

            messages.push(message);
        }

        if (batch.size < 100) {
            break;
        }

        before = batchMessages[batchMessages.length - 1].id;
    }

    return messages;
}

async function fetchAllMessages(channel) {
    const messages = [];
    let before;

    while (true) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {})
        }).catch(() => null);

        if (!batch || batch.size === 0) {
            break;
        }

        const batchMessages = [...batch.values()];
        messages.push(...batchMessages);

        if (batch.size < 100) {
            break;
        }

        before = batchMessages[batchMessages.length - 1].id;
    }

    return messages;
}

async function deleteMessages(channel, messages) {
    const recentMessages = messages.filter(isBulkDeleteSafe);
    const olderMessages = messages.filter(message => !isBulkDeleteSafe(message));

    let deletedCount = 0;

    for (let index = 0; index < recentMessages.length; index += 100) {
        const chunk = recentMessages.slice(index, index + 100);

        try {
            const deleted = await channel.bulkDelete(chunk, true);
            deletedCount += deleted.size;
        } catch {
            for (const message of chunk) {
                const deleted = await message.delete().then(() => true).catch(() => false);
                if (deleted) {
                    deletedCount += 1;
                }
            }
        }
    }

    for (const message of olderMessages) {
        const deleted = await message.delete().then(() => true).catch(() => false);
        if (deleted) {
            deletedCount += 1;
        }
    }

    return deletedCount;
}

function normalizeCount(value) {
    if (!Number.isInteger(value) || value < 1) {
        return null;
    }

    return Math.min(value, 1000);
}

function parseMessageReference(value, currentChannelId) {
    const input = String(value || '').trim();
    if (!input) {
        return null;
    }

    if (/^\d{17,20}$/.test(input)) {
        return { messageId: input };
    }

    const match = input.match(/^https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})$/i);
    if (!match) {
        return null;
    }

    const channelId = match[2];
    const messageId = match[3];

    if (channelId !== currentChannelId) {
        return { error: 'L\'ID o il link devono riferirsi a un messaggio di questo canale.' };
    }

    return { messageId };
}

function hasImageAttachment(message) {
    for (const attachment of message.attachments.values()) {
        const contentType = String(attachment.contentType || '').toLowerCase();
        if (contentType.startsWith('image/')) {
            return true;
        }

        const name = String(attachment.name || '').toLowerCase();
        if (/\.(png|jpe?g|gif|webp|bmp|tiff|avif|svg)$/.test(name)) {
            return true;
        }
    }

    return false;
}

function hasInviteLink(message) {
    return /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/i.test(message.content || '');
}

function hasLink(message) {
    return /https?:\/\/\S+/i.test(message.content || '');
}

function hasMention(message) {
    return Boolean(
        message.mentions?.everyone
        || message.mentions?.users?.size
        || message.mentions?.roles?.size
    );
}

function isTextMessage(message) {
    return Boolean((message.content || '').trim()) && message.attachments.size === 0;
}

async function collectMatchingMessages(channel, count, predicate, stopWhen = null, excludedMessageIds = new Set()) {
    const messages = [];
    let before;

    while (messages.length < count) {
        const limit = Math.min(100, count - messages.length);
        const batch = await channel.messages.fetch({
            limit,
            ...(before ? { before } : {})
        }).catch(() => null);

        if (!batch || batch.size === 0) {
            break;
        }

        const batchMessages = [...batch.values()];

        for (const message of batchMessages) {
            if (stopWhen && stopWhen(message)) {
                return messages;
            }

            if (excludedMessageIds.has(message.id)) {
                continue;
            }

            if (predicate(message)) {
                messages.push(message);

                if (messages.length >= count) {
                    return messages;
                }
            }
        }

        if (batch.size < limit) {
            break;
        }

        before = batchMessages[batchMessages.length - 1].id;
    }

    return messages;
}

module.exports = {
    data: (() => {
        const builder = new SlashCommandBuilder()
            .setName('purge')
            .setDescription('Elimina messaggi dal canale corrente')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .setDMPermission(false);

        const addCountOption = sub => sub.addIntegerOption(option => option.setName('count').setDescription('Numero di messaggi da eliminare').setMinValue(1).setRequired(false));

        builder
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('after')
                        .setDescription('Elimina i messaggi dopo un messaggio specifico')
                        .addStringOption(option => option.setName('message').setDescription('ID o link del messaggio di riferimento').setRequired(true))
                )
            )
            .addSubcommand(sub =>
                sub
                    .setName('all')
                    .setDescription('Elimina tutta la chat disponibile nel canale')
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('any')
                        .setDescription('Elimina qualsiasi tipo di messaggio')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('bots')
                        .setDescription('Elimina i messaggi inviati dai bot')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('embeds')
                        .setDescription('Elimina i messaggi che contengono embed')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('endswith')
                        .setDescription('Elimina i messaggi che finiscono con il testo selezionato')
                        .addStringOption(option => option.setName('text').setDescription('Testo da cercare alla fine del messaggio').setRequired(true))
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('humans')
                        .setDescription('Elimina i messaggi inviati dagli utenti umani')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('images')
                        .setDescription('Elimina i messaggi che contengono immagini')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('invites')
                        .setDescription('Elimina i messaggi che contengono inviti Discord')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('links')
                        .setDescription('Elimina i messaggi che contengono link')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('match')
                        .setDescription('Elimina i messaggi che contengono il testo selezionato')
                        .addStringOption(option => option.setName('text').setDescription('Testo da cercare nel messaggio').setRequired(true))
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('mentions')
                        .setDescription('Elimina i messaggi che contengono menzioni')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('not')
                        .setDescription('Elimina i messaggi che non contengono il testo selezionato')
                        .addStringOption(option => option.setName('text').setDescription('Testo da escludere dal messaggio').setRequired(true))
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('startswith')
                        .setDescription('Elimina i messaggi che iniziano con il testo selezionato')
                        .addStringOption(option => option.setName('text').setDescription('Testo da cercare all\'inizio del messaggio').setRequired(true))
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('text')
                        .setDescription('Elimina i messaggi testuali')
                )
            )
            .addSubcommand(sub =>
                addCountOption(
                    sub
                        .setName('user')
                        .setDescription('Elimina i messaggi inviati da un utente specifico')
                        .addUserOption(option => option.setName('utente').setDescription('Utente i cui messaggi devono essere eliminati').setRequired(true))
                )
            )
            .addSubcommand(sub =>
                sub
                    .setName('periodo')
                    .setDescription('Elimina i messaggi pubblicati in un periodo di tempo')
                    .addStringOption(option => option.setName('periodo_di_tempo').setDescription('Durata es: 1d2h30m').setRequired(true))
            )
            .addSubcommand(sub =>
                sub
                    .setName('fino_a')
                    .setDescription('Elimina i messaggi fino a una data specifica')
                    .addStringOption(option => option.setName('data').setDescription('Data es: 2026-04-09 oppure 2026-04-09 18:30').setRequired(true))
            );

        return builder;
    })(),

    async execute(interaction) {
        try {
            await interaction.deferReply();
        } catch (error) {
            if (error?.code === 10062) {
                return;
            }

            throw error;
        }

        if (!hasStaffRole(interaction)) {
            await interaction.editReply({
                embeds: [buildPurgeEmbed('❌ Questo comando è riservato allo staff.')]
            }).catch(() => null);
            return;
        }

        if (!interaction.inGuild() || !interaction.channel?.messages) {
            await interaction.editReply({
                embeds: [buildPurgeEmbed('❌ Questo comando può essere usato solo in un canale testuale del server.')]
            }).catch(() => null);
            return;
        }

        const interactionReply = await interaction.fetchReply().catch(() => null);

        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;
        const defaultCount = 100;
        const excludedMessageIds = new Set(interactionReply ? [interactionReply.id] : []);
        let messagesToDelete = [];
        let contextDescription = '';

        if (subcommand === 'after') {
            const reference = parseMessageReference(interaction.options.getString('message', true), channel.id);

            if (!reference) {
                await interaction.editReply({ embeds: [buildPurgeEmbed('❌ ID o link del messaggio non valido.')] });
                return;
            }

            if (reference.error) {
                await interaction.editReply({ embeds: [buildPurgeEmbed(`❌ ${reference.error}`)] });
                return;
            }

            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, () => true, message => BigInt(message.id) <= BigInt(reference.messageId), excludedMessageIds);
            contextDescription = `Messaggi dopo ${reference.messageId}`;
        } else if (subcommand === 'all') {
            messagesToDelete = await fetchAllMessages(channel);
            contextDescription = 'Tutta la chat disponibile';
        } else if (subcommand === 'any') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, () => true, null, excludedMessageIds);
            contextDescription = `Ultimi ${count} messaggi`;
        } else if (subcommand === 'bots') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => message.author.bot, null, excludedMessageIds);
            contextDescription = 'Messaggi dei bot';
        } else if (subcommand === 'embeds') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => message.embeds.length > 0, null, excludedMessageIds);
            contextDescription = 'Messaggi con embed';
        } else if (subcommand === 'endswith') {
            const text = interaction.options.getString('text', true).trim();
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => (message.content || '').endsWith(text), null, excludedMessageIds);
            contextDescription = `Messaggi che finiscono con ${text}`;
        } else if (subcommand === 'humans') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => !message.author.bot, null, excludedMessageIds);
            contextDescription = 'Messaggi degli utenti umani';
        } else if (subcommand === 'images') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => hasImageAttachment(message), null, excludedMessageIds);
            contextDescription = 'Messaggi con immagini';
        } else if (subcommand === 'invites') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => hasInviteLink(message), null, excludedMessageIds);
            contextDescription = 'Messaggi con inviti';
        } else if (subcommand === 'links') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => hasLink(message), null, excludedMessageIds);
            contextDescription = 'Messaggi con link';
        } else if (subcommand === 'match') {
            const text = interaction.options.getString('text', true).trim();
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => (message.content || '').includes(text), null, excludedMessageIds);
            contextDescription = `Messaggi che contengono ${text}`;
        } else if (subcommand === 'mentions') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => hasMention(message), null, excludedMessageIds);
            contextDescription = 'Messaggi con menzioni';
        } else if (subcommand === 'not') {
            const text = interaction.options.getString('text', true).trim();
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => !String(message.content || '').includes(text), null, excludedMessageIds);
            contextDescription = `Messaggi che non contengono ${text}`;
        } else if (subcommand === 'startswith') {
            const text = interaction.options.getString('text', true).trim();
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => (message.content || '').startsWith(text), null, excludedMessageIds);
            contextDescription = `Messaggi che iniziano con ${text}`;
        } else if (subcommand === 'text') {
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => isTextMessage(message), null, excludedMessageIds);
            contextDescription = 'Messaggi testuali';
        } else if (subcommand === 'user') {
            const user = interaction.options.getUser('utente', true);
            const count = normalizeCount(interaction.options.getInteger('count') ?? defaultCount);
            messagesToDelete = await collectMatchingMessages(channel, count, message => message.author.id === user.id, null, excludedMessageIds);
            contextDescription = `Messaggi di ${user.tag}`;
        } else if (subcommand === 'periodo') {
            const duration = interaction.options.getString('periodo_di_tempo', true);
            const durationMs = parseDuration(duration);

            if (!durationMs) {
                await interaction.editReply({ embeds: [buildPurgeEmbed('❌ Formato periodo non valido. Usa ad esempio `1d2h30m`.')] });
                return;
            }

            const cutoffTimestamp = Date.now() - durationMs;
            messagesToDelete = await fetchMessagesSince(channel, cutoffTimestamp);
            contextDescription = `Messaggi degli ultimi ${duration}`;
        } else if (subcommand === 'fino_a') {
            const cutoffDate = parseDateInput(interaction.options.getString('data', true));

            if (!cutoffDate) {
                await interaction.editReply({ embeds: [buildPurgeEmbed('❌ Formato data non valido. Usa ad esempio `2026-04-09` oppure `2026-04-09 18:30`.')] });
                return;
            }

            if (cutoffDate.getTime() > Date.now()) {
                await interaction.editReply({ embeds: [buildPurgeEmbed('❌ La data deve essere nel passato o al massimo nel presente.')] });
                return;
            }

            messagesToDelete = await fetchMessagesSince(channel, cutoffDate.getTime());
            contextDescription = `Messaggi fino al <t:${Math.floor(cutoffDate.getTime() / 1000)}:f>`;
        }

        if (interactionReply) {
            messagesToDelete = messagesToDelete.filter(message => message.id !== interactionReply.id);
        }

        if (messagesToDelete.length === 0) {
            await interaction.editReply({ embeds: [buildPurgeEmbed(`📭 Nessun messaggio da eliminare per ${contextDescription.toLowerCase()}.`)] });
            return;
        }

        try {
            const deletedCount = await deleteMessages(channel, messagesToDelete);

            await interaction.editReply({
                embeds: [buildPurgeEmbed(
                    `🧹 Eliminati **${deletedCount}** messaggi da ${channel}.`,
                    [
                        { name: 'Modalità', value: contextDescription, inline: false },
                        { name: 'Moderatore', value: `${interaction.user}`, inline: true }
                    ]
                )]
            });
        } catch (error) {
            await interaction.editReply({ embeds: [buildPurgeEmbed(`❌ Errore durante il purge: ${error.message}`)] }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildPurgeEmbed(`❌ Errore durante il purge: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};