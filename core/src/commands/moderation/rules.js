const fs = require('node:fs/promises');
const path = require('node:path');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, AttachmentBuilder } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { hasStaffRole, replyRoleDenied } = require('../../lib/permissions');

const RULE_TYPES = ['staff', 'team', 'server'];
const RULES_PATH = path.resolve(process.cwd(), 'data/rules/rules.json');
const SENT_MESSAGES_PATH = path.resolve(process.cwd(), 'data/rules/sent_messages.json');
const IMAGE_PATH = path.resolve(process.cwd(), 'data/rules/logo/Rules_MT.png');

function buildRulesEmbed(description, fields = []) {
    return buildResponseEmbed({
        title: 'Rules',
        description,
        fields
    });
}

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

function sanitizeType(ruleType) {
    const value = String(ruleType || '').toLowerCase().trim();
    return RULE_TYPES.includes(value) ? value : null;
}

function normalizeRules(list) {
    return (Array.isArray(list) ? list : [])
        .map(item => String(item || '').trim())
        .filter(Boolean);
}

function parseMultilineRules(text) {
    return String(text || '')
        .replace(/\|/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}

async function loadRules() {
    const base = { staff: [], team: [], server: [] };
    const data = await readJson(RULES_PATH, base);

    for (const type of RULE_TYPES) {
        base[type] = normalizeRules(data[type]);
    }

    return base;
}

async function saveRules(data) {
    await writeJson(RULES_PATH, data);
}

async function loadSentMessages() {
    return readJson(SENT_MESSAGES_PATH, {});
}

async function saveSentMessages(data) {
    await writeJson(SENT_MESSAGES_PATH, data);
}

async function deleteOldPublishedMessages(interaction, record) {
    if (!record || !record.channelId) return;

    const oldChannel = await interaction.guild.channels.fetch(record.channelId).catch(() => null);
    if (!oldChannel || oldChannel.type !== ChannelType.GuildText) return;

    for (const id of [record.imageMessageId, record.embedMessageId, record.legacyMessageId]) {
        if (!id) continue;
        const message = await oldChannel.messages.fetch(id).catch(() => null);
        if (!message) continue;
        await message.delete().catch(() => null);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Gestione regole del server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Aggiunge una regola singola')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo regole')
                        .setRequired(true)
                        .addChoices(
                            { name: 'staff', value: 'staff' },
                            { name: 'team', value: 'team' },
                            { name: 'server', value: 'server' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('testo')
                        .setDescription('Testo della regola')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Rimuove una regola per indice (partendo da 1)')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo regole')
                        .setRequired(true)
                        .addChoices(
                            { name: 'staff', value: 'staff' },
                            { name: 'team', value: 'team' },
                            { name: 'server', value: 'server' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('indice')
                        .setDescription('Numero regola (da 1)')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('edit')
                .setDescription('Modifica una regola specifica')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo regole')
                        .setRequired(true)
                        .addChoices(
                            { name: 'staff', value: 'staff' },
                            { name: 'team', value: 'team' },
                            { name: 'server', value: 'server' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('indice')
                        .setDescription('Numero regola (da 1)')
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addStringOption(option =>
                    option
                        .setName('testo')
                        .setDescription('Nuovo testo')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('create')
                .setDescription('Sostituisce l\'intera lista da testo multi-linea o separato con |')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo regole')
                        .setRequired(true)
                        .addChoices(
                            { name: 'staff', value: 'staff' },
                            { name: 'team', value: 'team' },
                            { name: 'server', value: 'server' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('testo')
                        .setDescription('Una regola per riga oppure separate da |')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('send')
                .setDescription('Invia immagine + embed regole')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo regole')
                        .setRequired(true)
                        .addChoices(
                            { name: 'staff', value: 'staff' },
                            { name: 'team', value: 'team' },
                            { name: 'server', value: 'server' }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName('canale')
                        .setDescription('Canale dove inviare le regole')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option
                        .setName('titolo')
                        .setDescription('Titolo personalizzato embed')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Mostra le regole di una categoria')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo regole')
                        .setRequired(true)
                        .addChoices(
                            { name: 'staff', value: 'staff' },
                            { name: 'team', value: 'team' },
                            { name: 'server', value: 'server' }
                        )
                )
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando moderation è riservato allo staff.');
            return;
        }

        const sub = interaction.options.getSubcommand();
        const type = sanitizeType(interaction.options.getString('tipo', true));

        if (!type) {
            await interaction.reply({
                embeds: [buildRulesEmbed('❌ Tipo non valido. Usa staff, team o server.')],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const rules = await loadRules();

        if (sub === 'add') {
            const text = interaction.options.getString('testo', true).trim();
            if (!text) {
                await interaction.editReply({
                    embeds: [buildRulesEmbed('❌ Devi inserire una regola valida.')]
                });
                return;
            }

            rules[type].push(text);
            await saveRules(rules);

            await interaction.editReply({
                embeds: [buildRulesEmbed(`✅ Regola aggiunta in **${type}** (totale: **${rules[type].length}**).`)]
            });
            return;
        }

        if (sub === 'remove') {
            const index = interaction.options.getInteger('indice', true);
            if (index < 1 || index > rules[type].length) {
                await interaction.editReply({
                    embeds: [buildRulesEmbed('❌ Numero regola non valido.')]
                });
                return;
            }

            const removed = rules[type].splice(index - 1, 1)[0];
            await saveRules(rules);

            await interaction.editReply({
                embeds: [buildRulesEmbed(`✅ Rimossa regola #${index} da **${type}**:\n${removed}`)]
            });
            return;
        }

        if (sub === 'edit') {
            const index = interaction.options.getInteger('indice', true);
            const newText = interaction.options.getString('testo', true).trim();

            if (index < 1 || index > rules[type].length) {
                await interaction.editReply({
                    embeds: [buildRulesEmbed('❌ Numero regola non valido.')]
                });
                return;
            }

            const oldText = rules[type][index - 1];
            rules[type][index - 1] = newText;
            await saveRules(rules);

            await interaction.editReply({
                embeds: [buildRulesEmbed(`✅ Modificata regola #${index} in **${type}**.`, [
                    { name: 'Prima', value: oldText },
                    { name: 'Dopo', value: newText }
                ])]
            });
            return;
        }

        if (sub === 'create') {
            const text = interaction.options.getString('testo', true);
            const parsed = parseMultilineRules(text);
            if (parsed.length === 0) {
                await interaction.editReply({
                    embeds: [buildRulesEmbed('❌ Nessuna regola valida trovata nel testo.')]
                });
                return;
            }

            rules[type] = parsed;
            await saveRules(rules);

            await interaction.editReply({
                embeds: [buildRulesEmbed(`✅ Lista **${type}** aggiornata con **${parsed.length}** regole.`)]
            });
            return;
        }

        if (sub === 'list') {
            const list = rules[type];
            if (list.length === 0) {
                await interaction.editReply({
                    embeds: [buildRulesEmbed(`📭 Nessuna regola configurata per **${type}**.`)]
                });
                return;
            }

            const body = list.map((rule, i) => `${i + 1}. ${rule}`).join('\n');
            await interaction.editReply({
                embeds: [buildRulesEmbed(`📜 Regole **${type}**\n\n${body}`)]
            });
            return;
        }

        if (sub === 'send') {
            const list = rules[type];
            if (list.length === 0) {
                await interaction.editReply({
                    embeds: [buildRulesEmbed(`❌ Nessuna regola configurata per **${type}**.`)]
                });
                return;
            }

            const channel = interaction.options.getChannel('canale', true);
            const customTitle = interaction.options.getString('titolo');
            const embedTitle = (customTitle || '').trim() || `📜 Rules - ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const ruleBody = list.map(text => `- ${text}`).join('\n');

            const sentMessages = await loadSentMessages();
            const guildId = String(interaction.guild.id);
            const old = sentMessages[guildId]?.[type];
            await deleteOldPublishedMessages(interaction, old);

            let imageMessageId = null;
            try {
                await fs.access(IMAGE_PATH);
                const imageAttachment = new AttachmentBuilder(IMAGE_PATH, { name: 'Rules_MT.png' });
                const imageMessage = await channel.send({ files: [imageAttachment] });
                imageMessageId = imageMessage.id;
            } catch {
                imageMessageId = null;
            }

            const publishEmbed = buildResponseEmbed({
                title: embedTitle,
                description: ruleBody,
                fields: []
            })
                .setColor(0xff7900)
                .setFooter({ text: `Grazie per aver letto le regole ${type}. Buona permanenza!` });

            if (interaction.guild.iconURL()) {
                publishEmbed.setThumbnail(interaction.guild.iconURL({ size: 256 }));
            }

            const embedMessage = await channel.send({ embeds: [publishEmbed] });

            if (!sentMessages[guildId]) sentMessages[guildId] = {};
            sentMessages[guildId][type] = {
                channelId: channel.id,
                imageMessageId,
                embedMessageId: embedMessage.id
            };
            await saveSentMessages(sentMessages);

            await interaction.editReply({
                embeds: [buildRulesEmbed(`✅ Regole **${type}** inviate in ${channel}. Se esisteva un vecchio messaggio, e stato sostituito.`)]
            });
        }
    }
};
