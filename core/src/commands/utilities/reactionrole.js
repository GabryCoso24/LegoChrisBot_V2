const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { setReactionRole, removeReactionRole } = require('../../../modules/reactionRoles/reactionRolesManager');
const { hasStaffRole, replyRoleDenied } = require('../../lib/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Gestisce i reaction role')
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Imposta un reaction role su un messaggio')
                .addStringOption(option =>
                    option
                        .setName('message_id')
                        .setDescription('ID del messaggio')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('Emoji da usare')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Ruolo da assegnare')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Rimuovi un reaction role da un messaggio')
                .addStringOption(option =>
                    option
                        .setName('message_id')
                        .setDescription('ID del messaggio')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('Emoji della reazione da rimuovere')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!hasStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando è riservato allo staff.');
            return;
        }

        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await interaction.reply({
                embeds: [buildResponseEmbed({
                    title: 'Reaction Roles',
                    description: 'Mi manca il permesso `Manage Roles` per gestire i reaction role.'
                })],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const messageId = interaction.options.getString('message_id', true);
            const emoji = interaction.options.getString('emoji', true);
            const role = interaction.options.getRole('role', true);
            await setReactionRole(interaction, messageId, emoji, role);
            return;
        }

        if (subcommand === 'remove') {
            const messageId = interaction.options.getString('message_id', true);
            const emoji = interaction.options.getString('emoji', true);
            await removeReactionRole(interaction, messageId, emoji);
        }
    }
};