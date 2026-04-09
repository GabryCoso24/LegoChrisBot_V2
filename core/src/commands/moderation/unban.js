const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
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
        .setName('unban')
        .setDescription('Sbanna un utente tramite ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option
                .setName('user_id')
                .setDescription('ID utente da sbannare')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo dello sban')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando moderation è riservato allo staff.');
            return;
        }

        await interaction.deferReply();

        const userId = interaction.options.getString('user_id', true).trim();
        const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';

        try {
            if (!/^\d{17,20}$/.test(userId)) {
                await interaction.editReply({
                    embeds: [buildModerationEmbed('Moderation - Unban', '❌ ID utente non valido.')]
                });
                return;
            }

            await interaction.guild.bans.remove(userId, `${reason} | By ${interaction.user.tag}`);

            await interaction.editReply({
                embeds: [buildModerationEmbed(
                    'Moderation - Unban',
                    `✅ <@${userId}> e stato sbannato con successo.`,
                    [
                        { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                        { name: 'Motivo', value: reason, inline: true }
                    ]
                )]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [buildModerationEmbed('Moderation - Unban', `❌ Errore: ${error.message}`)]
            }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildModerationEmbed('Moderation - Unban', `❌ Errore: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};
