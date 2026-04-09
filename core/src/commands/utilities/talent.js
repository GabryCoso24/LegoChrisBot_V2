const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const {
    getRoleLabel,
    registerUser,
    updateUserRole,
    canAssignPoints,
    addPointsToParticipant,
    getLeaderboard,
    getUsersGroupedByRole
} = require('../../../modules/talent/talentManager');
const config = require('../../config/config');

function buildTalentEmbed(description, fields = []) {
    return buildResponseEmbed({
        title: 'Talent Show',
        description,
        fields
    });
}

async function replyPublic(interaction, payload) {
    if (interaction.deferred) {
        await interaction.editReply(payload);
        return;
    }

    if (interaction.replied) {
        await interaction.followUp(payload);
        return;
    }

    await interaction.reply(payload);
}

async function replyEphemeral(interaction, payload) {
    const ephemeralPayload = { ...payload, flags: MessageFlags.Ephemeral };

    if (interaction.deferred) {
        await interaction.followUp(ephemeralPayload);
        await interaction.deleteReply().catch(() => null);
        return;
    }

    if (interaction.replied) {
        await interaction.followUp(ephemeralPayload);
        return;
    }

    await interaction.reply(ephemeralPayload);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('talent')
        .setDescription('Talent Show: registrazione, punteggi e classifiche')
        .addSubcommand(sub =>
            sub
                .setName('register')
                .setDescription('Registra un utente per il Talent Show')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('L\'utente da registrare')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('ruolo')
                        .setDescription('Ruolo dell\'utente')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Presentatore', value: 'host' },
                            { name: 'Giudice', value: 'judge' },
                            { name: 'Partecipante', value: 'participant' }
                        )
                )
                .addBooleanOption(option =>
                    option
                        .setName('anche_giudice')
                        .setDescription('Se il ruolo è Presentatore, indica se può fare anche il Giudice')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('add_points')
                .setDescription('Assegna punti a un partecipante (Solo Giudici/Presentatori/Admin)')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Il partecipante a cui dare punti')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('punti')
                        .setDescription('Numero di punti da assegnare')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('edit_role')
                .setDescription('Modifica il ruolo di un utente già registrato')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente già registrato da modificare')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('ruolo')
                        .setDescription('Nuovo ruolo dell\'utente')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Presentatore', value: 'host' },
                            { name: 'Giudice', value: 'judge' },
                            { name: 'Partecipante', value: 'participant' }
                        )
                )
                .addBooleanOption(option =>
                    option
                        .setName('anche_giudice')
                        .setDescription('Se il ruolo è Presentatore, indica se può fare anche il Giudice')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('leaderboard')
                .setDescription('Mostra la classifica del Talent Show')
        )
        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Mostra tutti gli utenti registrati al Talent Show')
        ),

    async execute(interaction) {
        const highStaffRoleId = config.highStaffRoleId;
        const hasHighStaffRole = Boolean(
            highStaffRoleId
            && interaction.inGuild()
            && interaction.member?.roles?.cache?.has(highStaffRoleId)
        );

        if (!hasHighStaffRole) {
            await replyEphemeral(interaction, {
                embeds: [buildTalentEmbed('❌ Solo l\'High Staff può usare questo comando.')]
            });
            return;
        }

        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'register') {
            const user = interaction.options.getUser('utente', true);
            const role = interaction.options.getString('ruolo', true);
            const alsoJudge = interaction.options.getBoolean('anche_giudice') ?? false;
            const result = await registerUser(user, role, role === 'host' ? alsoJudge : false);

            if (!result.ok && result.reason === 'already_registered') {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed(`⚠️ ${user} è già registrato come **${result.currentRoleLabel || getRoleLabel(result.currentRole, result.currentIsJudge, false)}**.`)]
                });
                return;
            }

            await replyPublic(interaction, {
                embeds: [buildTalentEmbed(`✅ ${user} registrato con successo come **${result.roleName}**!`)]
            });
            return;
        }

        if (subcommand === 'add_points') {
            const isAdmin = interaction.memberPermissions?.has('Administrator') ?? false;
            const authorized = await canAssignPoints(interaction.user.id, isAdmin);
            if (!authorized) {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed('❌ Solo i **Giudici**, i **Presentatori con permesso Giudice** o gli amministratori possono assegnare punti!')]
                });
                return;
            }

            const user = interaction.options.getUser('utente', true);
            const points = interaction.options.getInteger('punti', true);
            const result = await addPointsToParticipant(user, points);

            if (!result.ok && result.reason === 'not_registered') {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed(`❌ ${user} non è registrato al Talent Show.`)]
                });
                return;
            }

            if (!result.ok && result.reason === 'not_participant') {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed(`❌ ${user} non è un partecipante (è un **${result.currentRoleLabel || getRoleLabel(result.currentRole, result.currentIsJudge, false)}**).`)]
                });
                return;
            }

            await replyPublic(interaction, {
                embeds: [buildTalentEmbed(`🌟 **${points}** punti per ${user}!\nTotale: **${result.total}**\nAssegnati da **${interaction.user.username}**`)]
            });
            return;
        }

        if (subcommand === 'edit_role') {
            const user = interaction.options.getUser('utente', true);
            const role = interaction.options.getString('ruolo', true);
            const alsoJudge = interaction.options.getBoolean('anche_giudice') ?? false;
            const result = await updateUserRole(user, role, role === 'host' ? alsoJudge : false);

            if (!result.ok && result.reason === 'not_registered') {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed(`❌ ${user} non è registrato al Talent Show.`)]
                });
                return;
            }

            await replyPublic(interaction, {
                embeds: [buildTalentEmbed(`✅ Ruolo aggiornato: ${user} ora è **${result.roleName}**.`)]
            });
            return;
        }

        if (subcommand === 'leaderboard') {
            const participants = await getLeaderboard();

            if (participants.length === 0) {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed('📭 Nessun partecipante registrato o con punti.')]
                });
                return;
            }

            const leaderboardText = participants
                .map((entry, index) => {
                    const medal = index === 0
                        ? '🥇'
                        : index === 1
                            ? '🥈'
                            : index === 2
                                ? '🥉'
                                : `${index + 1}.`;
                    return `${medal} **${entry.name}**: ${entry.points} punti`;
                })
                .join('\n');

            await replyPublic(interaction, {
                embeds: [buildTalentEmbed(`🏆 Classifica Talent Show\n\n${leaderboardText}`)]
            });
            return;
        }

        if (subcommand === 'list') {
            const { grouped, total } = await getUsersGroupedByRole();
            const hosts = grouped.host;
            const judges = grouped.judge;
            const participants = grouped.participant;

            if (total === 0) {
                await replyEphemeral(interaction, {
                    embeds: [buildTalentEmbed('📭 Nessun utente registrato al Talent Show.')]
                });
                return;
            }

            const fields = [];

            if (hosts.length > 0) {
                fields.push({
                    name: `🎙️ Presentatori (${hosts.length})`,
                    value: hosts.map(user => `• **${user.name}**${user.isJudge ? ' _(anche Giudice)_' : ''}`).join('\n'),
                    inline: false
                });
            }

            if (judges.length > 0) {
                fields.push({
                    name: `⚖️ Giudici (${judges.length})`,
                    value: judges.map(user => `• **${user.name}**`).join('\n'),
                    inline: false
                });
            }

            if (participants.length > 0) {
                fields.push({
                    name: `🎤 Partecipanti (${participants.length})`,
                    value: participants.map(user => `• **${user.name}** - ${user.points} punti`).join('\n'),
                    inline: false
                });
            }

            await replyPublic(interaction, {
                embeds: [buildTalentEmbed(`📋 Utenti Registrati - Talent Show\nTotale utenti: **${total}**`, fields)]
            });
        }
    }
};
