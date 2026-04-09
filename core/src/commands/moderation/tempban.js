const fs = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { hasStaffRole, replyRoleDenied } = require('../../lib/permissions');

const DATA_PATH = path.resolve(process.cwd(), 'data/tempban/tempbans.json');

const runtime = {
    initialized: false,
    tempbans: new Map(),
    expired: new Map()
};

function buildTempbanEmbed(description, fields = []) {
    return buildResponseEmbed({
        title: 'TempBan',
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

function parseDuration(input) {
    const pattern = /(\d+)([smhdwMy])/g;
    const matches = [...String(input || '').matchAll(pattern)];
    if (matches.length === 0) return null;

    let seconds = 0;
    for (const match of matches) {
        const value = Number(match[1]);
        const unit = match[2];

        if (unit === 's') seconds += value;
        if (unit === 'm') seconds += value * 60;
        if (unit === 'h') seconds += value * 3600;
        if (unit === 'd') seconds += value * 86400;
        if (unit === 'w') seconds += value * 604800;
        if (unit === 'M') seconds += value * 2592000;
        if (unit === 'y') seconds += value * 31536000;
    }

    return seconds > 0 ? seconds : null;
}

async function persistState() {
    const data = { tempbans: {} };

    for (const [userId, info] of runtime.tempbans.entries()) {
        data.tempbans[userId] = {
            guildId: info.guildId,
            endTime: info.endTime.toISOString(),
            expired: false
        };
    }

    for (const [userId, info] of runtime.expired.entries()) {
        data.tempbans[userId] = {
            guildId: info.guildId,
            endTime: info.endTime,
            expired: true
        };
    }

    await writeJson(DATA_PATH, data);
}

function scheduleUnban(client, userId, guildId, endTime) {
    const existing = runtime.tempbans.get(String(userId));
    if (existing?.abortController) {
        existing.abortController.abort();
    }

    const msLeft = Math.max(endTime.getTime() - Date.now(), 0);
    const abortController = new AbortController();

    const taskPromise = (async () => {
        try {
            await sleep(msLeft, null, { signal: abortController.signal });
        } catch {
            return;
        }

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
            await guild.bans.remove(String(userId), 'Tempban scaduto automaticamente').catch(() => null);
        }

        runtime.tempbans.delete(String(userId));
        runtime.expired.set(String(userId), {
            guildId,
            endTime: endTime.toISOString()
        });
        await persistState();
    })();

    runtime.tempbans.set(String(userId), {
        guildId,
        endTime,
        abortController,
        taskPromise
    });
}

async function initialize(client) {
    if (runtime.initialized) return;

    const saved = await readJson(DATA_PATH, { tempbans: {} });
    const now = Date.now();

    for (const [userId, info] of Object.entries(saved.tempbans || {})) {
        const guildId = info.guildId;
        const endTime = new Date(info.endTime);
        const expired = Boolean(info.expired) || Number.isNaN(endTime.getTime()) || endTime.getTime() <= now;

        if (expired) {
            runtime.expired.set(userId, {
                guildId,
                endTime: Number.isNaN(endTime.getTime()) ? new Date().toISOString() : endTime.toISOString()
            });
            continue;
        }

        scheduleUnban(client, userId, guildId, endTime);
    }

    await persistState();
    runtime.initialized = true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempban')
        .setDescription('Gestisce tempban e scadenze automatiche')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Applica un tempban')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente da bannare temporaneamente')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('durata')
                        .setDescription('Durata es: 1d2h30m')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('motivo')
                        .setDescription('Motivo del tempban')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('modify')
                .setDescription('Modifica durata di un tempban attivo')
                .addStringOption(option =>
                    option
                        .setName('user_id')
                        .setDescription('ID utente con tempban attivo')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('durata')
                        .setDescription('Nuova durata es: 3d12h')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Rimuove tempban e sbanna subito')
                .addStringOption(option =>
                    option
                        .setName('user_id')
                        .setDescription('ID utente')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Mostra tempban attivi e scaduti')
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando moderation è riservato allo staff.');
            return;
        }

        await initialize(interaction.client);

        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (subcommand === 'add') {
            const user = interaction.options.getUser('utente', true);
            const duration = interaction.options.getString('durata', true);
            const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';
            const durationSeconds = parseDuration(duration);

            if (!durationSeconds) {
                await interaction.editReply({
                    embeds: [buildTempbanEmbed('❌ Formato durata non valido. Usa ad esempio `1d2h30m`.')]
                });
                return;
            }

            await interaction.guild.members.ban(user.id, { reason: `${reason} | By ${interaction.user.tag}` });

            const endTime = new Date(Date.now() + durationSeconds * 1000);
            scheduleUnban(interaction.client, user.id, interaction.guild.id, endTime);
            await persistState();

            await interaction.editReply({
                embeds: [buildTempbanEmbed(
                    `🟠 ${user} e stato bannato temporaneamente per **${duration}**.`,
                    [
                        { name: 'Motivo', value: reason, inline: false },
                        { name: 'Fine', value: `<t:${Math.floor(endTime.getTime() / 1000)}:f>`, inline: false }
                    ]
                )]
            });
            return;
        }

        if (subcommand === 'modify') {
            const userId = interaction.options.getString('user_id', true).trim();
            const duration = interaction.options.getString('durata', true);
            const active = runtime.tempbans.get(userId);

            if (!active) {
                await interaction.editReply({
                    embeds: [buildTempbanEmbed('❌ Nessun tempban attivo per questo utente.')]
                });
                return;
            }

            const durationSeconds = parseDuration(duration);
            if (!durationSeconds) {
                await interaction.editReply({
                    embeds: [buildTempbanEmbed('❌ Formato durata non valido.')]
                });
                return;
            }

            const endTime = new Date(Date.now() + durationSeconds * 1000);
            scheduleUnban(interaction.client, userId, interaction.guild.id, endTime);
            await persistState();

            await interaction.editReply({
                embeds: [buildTempbanEmbed(`✅ Durata tempban aggiornata a **${duration}**.\nNuova fine: <t:${Math.floor(endTime.getTime() / 1000)}:f>`)]
            });
            return;
        }

        if (subcommand === 'remove') {
            const userId = interaction.options.getString('user_id', true).trim();
            const active = runtime.tempbans.get(userId);

            if (!active) {
                await interaction.editReply({
                    embeds: [buildTempbanEmbed('❌ Nessun tempban attivo per questo utente.')]
                });
                return;
            }

            active.abortController.abort();
            runtime.tempbans.delete(userId);
            runtime.expired.set(userId, {
                guildId: interaction.guild.id,
                endTime: new Date().toISOString()
            });

            await interaction.guild.bans.remove(userId, `Tempban rimosso manualmente da ${interaction.user.tag}`).catch(() => null);
            await persistState();

            await interaction.editReply({
                embeds: [buildTempbanEmbed('✅ Tempban rimosso e utente sbannato subito.')]
            });
            return;
        }

        if (subcommand === 'list') {
            const lines = [];

            for (const [userId, info] of runtime.tempbans.entries()) {
                lines.push(`🟠 <@${userId}>\n(ID: \`${userId}\`)\nFine: <t:${Math.floor(info.endTime.getTime() / 1000)}:f>\nStato: **ATTIVO**`);
            }

            for (const [userId, info] of runtime.expired.entries()) {
                const end = new Date(info.endTime);
                lines.push(`⚫ <@${userId}>\n(ID: \`${userId}\`)\nFine: <t:${Math.floor(end.getTime() / 1000)}:f>\nStato: **SCADUTO**`);
            }

            if (lines.length === 0) {
                await interaction.editReply({
                    embeds: [buildTempbanEmbed('📭 Nessun tempban registrato.')]
                });
                return;
            }

            const chunks = [];
            for (let i = 0; i < lines.length; i += 20) {
                chunks.push(lines.slice(i, i + 20));
            }

            await interaction.editReply({
                embeds: [buildTempbanEmbed(chunks[0].join('\n\n'))]
            });

            for (let i = 1; i < chunks.length; i += 1) {
                await interaction.followUp({
                    embeds: [buildTempbanEmbed(chunks[i].join('\n\n'))],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
