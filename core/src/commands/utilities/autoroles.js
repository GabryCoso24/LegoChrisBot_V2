const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { hasHighStaffRole, replyRoleDenied } = require('../../lib/permissions');
const {
    getConfig,
    addRole,
    removeRole,
    setEnabled,
    clearRoles
} = require('../../../modules/autoRoles/autoRolesManager');

function buildAutoRolesEmbed(title, description, fields = [], color = 0xff7900) {
    return buildResponseEmbed({ title, description, fields, color });
}

// Opzioni tipo condivise
const TIPO_CHOICES = [
    { name: '👤 Utenti', value: 'utenti' },
    { name: '🤖 Bot', value: 'bot' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroles')
        .setDescription('Gestisce i ruoli assegnati automaticamente al join')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Aggiunge un ruolo alla lista degli auto roles')
                .addRoleOption(opt =>
                    opt.setName('ruolo').setDescription('Ruolo da aggiungere').setRequired(true)
                )
                .addStringOption(opt =>
                    opt
                        .setName('tipo')
                        .setDescription('A chi assegnare il ruolo al join')
                        .setRequired(true)
                        .addChoices(...TIPO_CHOICES)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Rimuove un ruolo dalla lista degli auto roles')
                .addRoleOption(opt =>
                    opt.setName('ruolo').setDescription('Ruolo da rimuovere').setRequired(true)
                )
                .addStringOption(opt =>
                    opt
                        .setName('tipo')
                        .setDescription('Lista da cui rimuovere il ruolo')
                        .setRequired(true)
                        .addChoices(...TIPO_CHOICES)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list').setDescription('Mostra i ruoli configurati per utenti e bot')
        )
        .addSubcommand(sub =>
            sub.setName('enable').setDescription('Abilita l\'assegnazione automatica dei ruoli al join')
        )
        .addSubcommand(sub =>
            sub.setName('disable').setDescription('Disabilita l\'assegnazione automatica dei ruoli al join')
        )
        .addSubcommand(sub =>
            sub
                .setName('clear')
                .setDescription('Rimuove tutti i ruoli da una lista')
                .addStringOption(opt =>
                    opt
                        .setName('tipo')
                        .setDescription('Quale lista svuotare')
                        .setRequired(true)
                        .addChoices(
                            { name: '👤 Utenti', value: 'utenti' },
                            { name: '🤖 Bot', value: 'bot' },
                            { name: '🗑️ Tutti (utenti + bot)', value: 'tutti' }
                        )
                )
        ),

    async execute(interaction) {
        if (!hasHighStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Il comando autoroles è riservato all\'High Staff.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        // ── /autoroles add ──
        if (subcommand === 'add') {
            const role = interaction.options.getRole('ruolo', true);
            const tipo = interaction.options.getString('tipo', true);
            const tipoLabel = tipo === 'bot' ? '🤖 Bot' : '👤 Utenti';

            if (role.managed) {
                await interaction.reply({
                    embeds: [buildAutoRolesEmbed('❌ Auto Roles — Errore', `Il ruolo ${role} è gestito da un\'integrazione esterna e non può essere assegnato automaticamente.`, [], 0xff4d4d)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const me = interaction.guild.members.me ?? interaction.guild.members.cache.get(interaction.client.user.id);
            if (me && role.position >= me.roles.highest.position) {
                await interaction.reply({
                    embeds: [buildAutoRolesEmbed('❌ Auto Roles — Errore', `Non posso assegnare il ruolo ${role}: la sua posizione è uguale o superiore al mio ruolo più alto.`, [], 0xff4d4d)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const added = await addRole(role.id, tipo);
            if (!added) {
                await interaction.reply({
                    embeds: [buildAutoRolesEmbed('⚠️ Auto Roles', `Il ruolo ${role} è già nella lista **${tipoLabel}**.`, [], 0xf0a500)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.reply({
                embeds: [buildAutoRolesEmbed(
                    '✅ Auto Roles — Ruolo aggiunto',
                    `${role} verrà assegnato automaticamente ai nuovi **${tipoLabel}** al join.`,
                    [{ name: 'Lista', value: tipoLabel, inline: true }]
                )],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /autoroles remove ──
        if (subcommand === 'remove') {
            const role = interaction.options.getRole('ruolo', true);
            const tipo = interaction.options.getString('tipo', true);
            const tipoLabel = tipo === 'bot' ? '🤖 Bot' : '👤 Utenti';

            const removed = await removeRole(role.id, tipo);
            if (!removed) {
                await interaction.reply({
                    embeds: [buildAutoRolesEmbed('⚠️ Auto Roles', `Il ruolo ${role} non è nella lista **${tipoLabel}**.`, [], 0xf0a500)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.reply({
                embeds: [buildAutoRolesEmbed('✅ Auto Roles — Ruolo rimosso', `${role} è stato rimosso dalla lista **${tipoLabel}**.`)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /autoroles list ──
        if (subcommand === 'list') {
            const config = getConfig();

            function formatList(ids) {
                if (!ids || ids.length === 0) return '*(nessuno)*';
                return ids.map((id, i) => {
                    const role = interaction.guild.roles.cache.get(id);
                    return `${i + 1}. ${role ? role.toString() : `ID: \`${id}\` *(non trovato)*`}`;
                }).join('\n');
            }

            const fields = [
                { name: '📡 Stato', value: config.enabled ? '✅ Abilitato' : '⏸️ Disabilitato', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: `👤 Ruoli Utenti (${(config.userRoleIds ?? []).length})`, value: formatList(config.userRoleIds), inline: false },
                { name: `🤖 Ruoli Bot (${(config.botRoleIds ?? []).length})`, value: formatList(config.botRoleIds), inline: false }
            ];

            await interaction.reply({
                embeds: [buildAutoRolesEmbed('📋 Auto Roles — Lista', 'Ruoli assegnati automaticamente al join:', fields)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /autoroles enable ──
        if (subcommand === 'enable') {
            await setEnabled(true);
            await interaction.reply({
                embeds: [buildAutoRolesEmbed('✅ Auto Roles — Abilitati', 'L\'assegnazione automatica dei ruoli al join è ora **abilitata**.')],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /autoroles disable ──
        if (subcommand === 'disable') {
            await setEnabled(false);
            await interaction.reply({
                embeds: [buildAutoRolesEmbed('⏸️ Auto Roles — Disabilitati', 'L\'assegnazione automatica dei ruoli al join è ora **disabilitata**.', [], 0x808080)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /autoroles clear ──
        if (subcommand === 'clear') {
            const tipo = interaction.options.getString('tipo', true);
            const config = getConfig();

            const countUtenti = config.userRoleIds?.length ?? 0;
            const countBot = config.botRoleIds?.length ?? 0;

            const isEmpty =
                (tipo === 'utenti' && countUtenti === 0) ||
                (tipo === 'bot' && countBot === 0) ||
                (tipo === 'tutti' && countUtenti === 0 && countBot === 0);

            if (isEmpty) {
                await interaction.reply({
                    embeds: [buildAutoRolesEmbed('⚠️ Auto Roles', 'La lista selezionata è già vuota.', [], 0xf0a500)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await clearRoles(tipo);

            const tipoLabel = tipo === 'utenti' ? '👤 Utenti' : tipo === 'bot' ? '🤖 Bot' : '🗑️ Tutti';
            const removed = tipo === 'tutti' ? countUtenti + countBot : tipo === 'bot' ? countBot : countUtenti;

            await interaction.reply({
                embeds: [buildAutoRolesEmbed('🗑️ Auto Roles — Lista svuotata', `Rimossi **${removed}** ruolo/i dalla lista **${tipoLabel}**.`)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }
};
