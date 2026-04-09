const { SlashCommandBuilder, ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { hasHighStaffRole, replyRoleDenied } = require('../../lib/permissions');

function buildRolesEmbed(title, description, fields = [], color = 0x3498db) {
    return buildResponseEmbed({
        title,
        description,
        fields,
        color
    });
}

async function resolveRoles(interaction, rawRoles) {
    const roleIds = [...String(rawRoles || '').matchAll(/<@&(\d+)>/g)].map(match => match[1]);
    const uniqueIds = [...new Set(roleIds)];

    const found = [];
    const missing = [];

    for (const roleId of uniqueIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
            found.push(role);
        } else {
            missing.push(roleId);
        }
    }

    return { found, missing };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Gestione ruoli bulk e mirata')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Aggiunge uno o più ruoli a un membro o a tutti gli utenti umani')
                .addStringOption(option =>
                    option
                        .setName('ruoli')
                        .setDescription('Menziona uno o più ruoli separati da spazio')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option
                        .setName('membro')
                        .setDescription('Membro destinatario')
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName('tutti')
                        .setDescription('Applica a tutti gli utenti non bot')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Rimuove un ruolo a un membro')
                .addUserOption(option =>
                    option
                        .setName('membro')
                        .setDescription('Membro da modificare')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('ruolo')
                        .setDescription('Ruolo da rimuovere')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!hasHighStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Questo comando ruoli è riservato all\'High Staff.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'add') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const rawRoles = interaction.options.getString('ruoli', true);
                const targetMember = interaction.options.getUser('membro');
                const applyToAll = interaction.options.getBoolean('tutti') ?? false;
                const { found: roles, missing } = await resolveRoles(interaction, rawRoles);

                if (roles.length === 0) {
                    await interaction.editReply({
                        embeds: [buildRolesEmbed('Ruoli', '❌ Non ho trovato menzioni di ruoli valide.')]
                    });
                    return;
                }

                const me = interaction.guild.members.me || interaction.guild.members.cache.get(interaction.client.user.id);
                const assignableRoles = roles.filter(role => role.editable || role.position < me.roles.highest.position);
                const blockedRoles = roles.filter(role => !assignableRoles.includes(role));

                if (assignableRoles.length === 0) {
                    await interaction.editReply({
                        embeds: [buildRolesEmbed('Ruoli', '❌ Non posso assegnare nessuno dei ruoli indicati.')]
                    });
                    return;
                }

                let targets = [];
                if (applyToAll) {
                    targets = interaction.guild.members.cache.filter(member => !member.user.bot).map(member => member);
                } else {
                    if (!targetMember) {
                        await interaction.editReply({
                            embeds: [buildRolesEmbed('Ruoli', '❌ Devi specificare un membro oppure attivare `tutti`.')]
                        });
                        return;
                    }
                    const member = await interaction.guild.members.fetch(targetMember.id).catch(() => null);
                    if (!member) {
                        await interaction.editReply({
                            embeds: [buildRolesEmbed('Ruoli', '❌ Membro non trovato nel server.')]
                        });
                        return;
                    }
                    if (member.user.bot) {
                        await interaction.editReply({
                            embeds: [buildRolesEmbed('Ruoli', '❌ Non assegno ruoli ai bot.')]
                        });
                        return;
                    }
                    targets = [member];
                }

                let successCount = 0;
                let skippedCount = 0;
                let failedCount = 0;

                for (const member of targets) {
                    const toAdd = assignableRoles.filter(role => !member.roles.cache.has(role.id));
                    if (toAdd.length === 0) {
                        skippedCount += 1;
                        continue;
                    }

                    try {
                        await member.roles.add(toAdd, `Richiesto da ${interaction.user.tag} via /roles add`);
                        successCount += 1;
                    } catch {
                        failedCount += 1;
                    }
                }

                const fields = [
                    { name: 'Ruoli richiesti', value: roles.map(role => role.mention).join(' '), inline: false },
                    { name: 'Destinatari', value: applyToAll ? `Tutti gli utenti non bot (${targets.length})` : `${targets[0]}`, inline: false },
                    { name: 'Successi', value: String(successCount), inline: true },
                    { name: 'Già presenti', value: String(skippedCount), inline: true },
                    { name: 'Falliti', value: String(failedCount), inline: true }
                ];

                if (missing.length > 0) {
                    fields.push({ name: 'ID non trovati', value: missing.join(', '), inline: false });
                }

                if (blockedRoles.length > 0) {
                    fields.push({ name: 'Non gestibili', value: blockedRoles.map(role => role.mention).join(' '), inline: false });
                }

                await interaction.editReply({
                    embeds: [buildRolesEmbed('Assegnazione Ruoli', 'Operazione completata.', fields)]
                });
                return;
            }

            if (subcommand === 'remove') {
                const member = interaction.options.getMember('membro', true);
                const role = interaction.options.getRole('ruolo', true);

                if (!member.roles.cache.has(role.id)) {
                    await interaction.reply({
                        embeds: [buildRolesEmbed('Rimozione Ruolo', `❌ ${member} non ha ${role}.`)],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await member.roles.remove(role, `Richiesto da ${interaction.user.tag} via /roles remove`);

                await interaction.reply({
                    embeds: [buildRolesEmbed('Rimozione Ruolo', `✅ Rimosso ${role} da ${member}.`)]
                });
            }
        } catch (error) {
            await interaction.reply({
                embeds: [buildRolesEmbed('Ruoli', `❌ Errore: ${error.message}`, [], 0xff4d4d)],
                flags: MessageFlags.Ephemeral
            }).catch(() => null);
        }
    }
};
