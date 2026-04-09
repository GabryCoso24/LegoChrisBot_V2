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
        .setName('untimeout')
        .setDescription('Rimuove sia il mute testuale che quello vocale')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.MuteMembers)
        .addUserOption(option =>
            option
                .setName('utente')
                .setDescription('Utente da ripristinare')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo della rimozione completa')
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
        const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - UnTimeout', '❌ Utente non trovato nel server.')]
            });
            return;
        }

        try {
            await member.timeout(null, `${reason} | By ${interaction.user.tag}`);
            const removedVoiceMute = await releaseMute(interaction.client, interaction.guild.id, user.id);

            if (member.voice?.channel) {
                await member.voice.setMute(false, `${reason} | By ${interaction.user.tag}`).catch(() => null);
            }

            await interaction.editReply({
                embeds: [buildModerationEmbed(
                    'Moderation - Timeout Removed',
                    `✅ ${user} e stato ripristinato: timeout testuale rimosso e mute vocale eliminato.`,
                    [
                        { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                        { name: 'Motivo', value: reason, inline: false },
                        { name: 'Mute vocale', value: removedVoiceMute ? 'Rimosso' : 'Non presente', inline: true }
                    ]
                )]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Timeout Removed', `❌ Errore: ${error.message}`)]
            }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildModerationEmbed('Moderation - Timeout Removed', `❌ Errore: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};
