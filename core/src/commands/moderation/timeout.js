const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { initialize, applyVoiceMute } = require('../../../modules/moderation/voiceMuteManager');
const { hasStaffRole, replyRoleDenied } = require('../../lib/permissions');

function buildModerationEmbed(title, description, fields = []) {
    return buildResponseEmbed({
        title,
        description,
        fields
    });
}

function parseDuration(duration) {
    const pattern = /(\d+)([smhdwMy])/g;
    const matches = [...String(duration || '').matchAll(pattern)];
    if (matches.length === 0) return null;

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Applica mute testuale e vocale insieme')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.MuteMembers)
        .addUserOption(option =>
            option
                .setName('utente')
                .setDescription('Utente da mutare')
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
                .setDescription('Motivo del timeout')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando moderation è riservato allo staff.');
            return;
        }

        await initialize(interaction.client);
        await interaction.deferReply();

        const user = interaction.options.getUser('utente', true);
        const duration = interaction.options.getString('durata', true);
        const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';
        const durationMs = parseDuration(duration);

        if (!durationMs) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Timeout', '❌ Formato durata non valido. Usa ad esempio `1d2h30m`.')]
            });
            return;
        }

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Timeout', '❌ Utente non trovato nel server.')]
            });
            return;
        }

        try {
            await member.timeout(durationMs, `${reason} | By ${interaction.user.tag}`);

            let voiceLine = 'Mute vocale non applicato: utente non in voce.';
            if (member.voice?.channel) {
                const endTime = await applyVoiceMute(interaction.client, member, durationMs, reason, interaction.user.tag);
                voiceLine = `Mute vocale applicato fino a <t:${Math.floor(endTime.getTime() / 1000)}:f>.`;
            }

            await interaction.editReply({
                embeds: [buildModerationEmbed(
                    'Moderation - Timeout',
                    `⏳ ${user} e stato mutato nel testo e timeout applicato.`,
                    [
                        { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                        { name: 'Durata', value: duration, inline: true },
                        { name: 'Motivo', value: reason, inline: false },
                        { name: 'Voce', value: voiceLine, inline: false }
                    ]
                )]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Timeout', `❌ Errore: ${error.message}`)]
            }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildModerationEmbed('Moderation - Timeout', `❌ Errore: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};
