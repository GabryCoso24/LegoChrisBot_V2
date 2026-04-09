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
        .setName('mute')
        .setDescription('Gestisce i mute testuali e vocali')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.MuteMembers)
        .addSubcommand(sub =>
            sub
                .setName('text')
                .setDescription('Muta il testo usando il timeout di Discord')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente da mutare nel testo')
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
                        .setDescription('Motivo del mute')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('voice')
                .setDescription('Muta la voce nel canale vocale')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente da mutare in voce')
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
                        .setDescription('Motivo del mute')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando moderation è riservato allo staff.');
            return;
        }

        await initialize(interaction.client);
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('utente', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';
        const duration = interaction.options.getString('durata', true);
        const durationMs = parseDuration(duration);

        if (!member) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Mute', '❌ Utente non trovato nel server.')]
            });
            return;
        }

        if (!durationMs) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Mute', '❌ Formato durata non valido. Usa ad esempio `1d2h30m`.')]
            });
            return;
        }

        try {
            if (subcommand === 'text') {
                await member.timeout(durationMs, `${reason} | By ${interaction.user.tag}`);

                await interaction.editReply({
                    embeds: [buildModerationEmbed(
                        'Moderation - Text Mute',
                        `🔇 ${user} e stato mutato nel testo.`,
                        [
                            { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                            { name: 'Durata', value: duration, inline: true },
                            { name: 'Motivo', value: reason, inline: false }
                        ]
                    )]
                });
                return;
            }

            if (subcommand === 'voice') {
                if (!member.voice?.channel) {
                    await interaction.editReply({
                        embeds: [buildModerationEmbed('Moderation - Voice Mute', '❌ L\'utente non e in un canale vocale.')]
                    });
                    return;
                }

                const endTime = await applyVoiceMute(interaction.client, member, durationMs, reason, interaction.user.tag);

                await interaction.editReply({
                    embeds: [buildModerationEmbed(
                        'Moderation - Voice Mute',
                        `🔇 ${user} e stato mutato in voce.`,
                        [
                            { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                            { name: 'Durata', value: duration, inline: true },
                            { name: 'Fine', value: `<t:${Math.floor(endTime.getTime() / 1000)}:f>`, inline: true },
                            { name: 'Motivo', value: reason, inline: false }
                        ]
                    )]
                });
            }
        } catch (error) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Mute', `❌ Errore: ${error.message}`)]
            }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildModerationEmbed('Moderation - Mute', `❌ Errore: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};
