const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { initialize, releaseMute } = require('../../../modules/moderation/voiceMuteManager');
const { hasStaffRole, replyRoleDenied } = require('../../lib/permissions');

function buildModerationEmbed(title, description, fields = []) {
    return buildResponseEmbed({
        title,
        description,
        fields
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Rimuove mute testuale o vocale')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.MuteMembers)
        .addSubcommand(sub =>
            sub
                .setName('text')
                .setDescription('Rimuove il timeout testuale')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente da smutare nel testo')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('motivo')
                        .setDescription('Motivo della rimozione mute')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('voice')
                .setDescription('Rimuove il mute vocale')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente da smutare in voce')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('motivo')
                        .setDescription('Motivo della rimozione mute')
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

        if (!member) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Unmute', '❌ Utente non trovato nel server.')]
            });
            return;
        }

        try {
            if (subcommand === 'text') {
                await member.timeout(null, `${reason} | By ${interaction.user.tag}`);

                await interaction.editReply({
                    embeds: [buildModerationEmbed(
                        'Moderation - Text Unmute',
                        `🔊 ${user} e stato smutato nel testo.`,
                        [
                            { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                            { name: 'Motivo', value: reason, inline: false }
                        ]
                    )]
                });
                return;
            }

            if (subcommand === 'voice') {
                const removed = await releaseMute(interaction.client, interaction.guild.id, user.id);

                if (!removed && !member.voice?.channel) {
                    await interaction.editReply({
                        embeds: [buildModerationEmbed('Moderation - Voice Unmute', '❌ Non risulta nessun mute vocale attivo per questo utente.')]
                    });
                    return;
                }

                if (member.voice?.channel) {
                    await member.voice.setMute(false, `${reason} | By ${interaction.user.tag}`).catch(() => null);
                }

                await interaction.editReply({
                    embeds: [buildModerationEmbed(
                        'Moderation - Voice Unmute',
                        `🔊 ${user} e stato smutato in voce.`,
                        [
                            { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                            { name: 'Motivo', value: reason, inline: false }
                        ]
                    )]
                });
            }
        } catch (error) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Unmute', `❌ Errore: ${error.message}`)]
            }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildModerationEmbed('Moderation - Unmute', `❌ Errore: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};
