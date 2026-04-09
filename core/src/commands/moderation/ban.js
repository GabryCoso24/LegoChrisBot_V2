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
        .setName('ban')
        .setDescription('Comando di ban')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(sub =>
            sub
                .setName('user')
                .setDescription('Banna un membro del server')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Membro da bannare')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('motivo')
                        .setDescription('Motivo del ban')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando moderation è riservato allo staff.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'user') {
                const target = interaction.options.getUser('utente', true);
                const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';

                await interaction.guild.members.ban(target.id, { reason: `${reason} | By ${interaction.user.tag}` });

                await interaction.reply({
                    embeds: [buildModerationEmbed(
                        'Moderation - Ban',
                        `🔨 ${target} e stato bannato con successo.`,
                        [
                            { name: 'Moderatore', value: `${interaction.user}`, inline: true },
                            { name: 'Motivo', value: reason, inline: true }
                        ]
                    )]
                });
                return;
            }

        } catch (error) {
            await interaction.reply({
                embeds: [buildModerationEmbed('Moderation', `❌ Errore: ${error.message}`)],
                flags: MessageFlags.Ephemeral
            }).catch(async () => {
                await interaction.followUp({
                    embeds: [buildModerationEmbed('Moderation', `❌ Errore: ${error.message}`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            });
        }
    }
};
