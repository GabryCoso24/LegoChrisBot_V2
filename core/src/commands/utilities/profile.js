const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');

const NINTENDO_CHARACTERS = [
    'Mario',
    'Luigi',
    'Peach',
    'Bowser',
    'Yoshi',
    'Kirby',
    'Meta Knight',
    'King Dedede',
    'Pikachu',
    'Charizard',
    'Bulbasaur',
    'Squirtle',
    'Eevee',
    'Mewtwo',
    'Link',
    'Zelda',
    'Ganondorf',
    'Samus',
    'Fox McCloud',
    'Captain Falcon',
    'Kirby',
    'Donkey Kong',
    'Wario',
    'Rosalina',
    'Jigglypuff'
];

const NINTENDO_BONUS_CHANCE = 200;

function buildProfileEmbed(title, description, fields = [], color = 0xff7900) {
    return buildResponseEmbed({
        title,
        description,
        fields,
        color
    });
}

function getAvatarUrl(user) {
    return user.displayAvatarURL?.({ dynamic: true, size: 1024 }) || user.avatarURL?.({ dynamic: true, size: 1024 }) || null;
}

function formatPresenceStatus(status) {
    if (!status) return 'offline';
    const map = {
        online: 'online',
        idle: 'idle',
        dnd: 'dnd',
        offline: 'offline',
        invisible: 'invisible'
    };
    return map[status] || String(status);
}

function formatRoles(member) {
    const roleCache = member?.roles?.cache;
    if (!roleCache) {
        return { count: 0, value: 'Nessuno' };
    }

    const roles = [...roleCache.values()]
        .filter(role => role && role.name !== '@everyone')
        .sort((a, b) => (b?.position || 0) - (a?.position || 0));

    const mentions = roles
        .map(role => {
            if (typeof role.mention === 'string' && role.mention.length > 0) {
                return role.mention;
            }

            if (role.id) {
                return `<@&${role.id}>`;
            }

            return null;
        })
        .filter(Boolean);

    if (mentions.length === 0) {
        return { count: 0, value: 'Nessuno' };
    }

    let value = '';
    for (const mention of mentions) {
        if (typeof mention !== 'string' || mention.length === 0) continue;
        const next = value ? `${value} ${mention}` : mention;
        if (next.length > 1000) break;
        value = next;
    }

    return {
        count: mentions.length,
        value: value || 'Nessuno'
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Comandi profilo e ID utente')
        .addSubcommand(sub =>
            sub
                .setName('userinfo')
                .setDescription('Mostra le informazioni di un utente')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente da mostrare')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('id')
                .setDescription('Mostra l\'ID di un utente')
                .addUserOption(option =>
                    option
                        .setName('utente')
                        .setDescription('Utente di cui mostrare l\'ID')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'userinfo') {
            const targetUser = interaction.options.getUser('utente') || interaction.user;
            const member = await interaction.guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
            if (!member) {
                await interaction.reply({
                    embeds: [buildProfileEmbed('Profilo', '❌ Utente non trovato nel server.', [], 0xff4d4d)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const randomCharacter = NINTENDO_CHARACTERS[Math.floor(Math.random() * NINTENDO_CHARACTERS.length)];
            const hasNintendoBonus = Math.floor(Math.random() * NINTENDO_BONUS_CHANCE) === 0;
            const joinedAt = member.joinedAt || null;
            const createdAt = member.user.createdAt || null;
            const rolesInfo = formatRoles(member);

            const fields = [
                { name: 'Nome', value: member.user.username, inline: true },
                { name: 'Nickname', value: member.displayName || member.user.username, inline: true },
                { name: 'ID', value: member.id, inline: false },
                { name: 'Status', value: formatPresenceStatus(member.presence?.status), inline: true },
                { name: 'Bot', value: member.user.bot ? 'Sì' : 'No', inline: true },
                {
                    name: 'Ruolo più alto',
                    value: member.roles.highest?.id && member.roles.highest.name !== '@everyone' ? member.roles.highest.mention : 'Nessuno',
                    inline: true
                },
                {
                    name: `Ruoli (${rolesInfo.count})`,
                    value: rolesInfo.value,
                    inline: false
                }
            ];

            if (joinedAt) {
                fields.push({
                    name: 'Entrato nel server',
                    value: `<t:${Math.floor(joinedAt.getTime() / 1000)}:F>`,
                    inline: false
                });
            }

            if (createdAt) {
                fields.push({
                    name: 'Account creato',
                    value: `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`,
                    inline: false
                });
            }

            if (hasNintendoBonus) {
                fields.push({
                    name: 'Bonus Nintendo',
                    value: `Personaggio raro trovato: **${randomCharacter}**`,
                    inline: false
                });
            }

            const embed = buildProfileEmbed(
                `${member.user.username} - Profilo`,
                `Informazioni su **${member.user.username}**`,
                fields
            );

            const avatarUrl = getAvatarUrl(member.user);
            if (avatarUrl) {
                embed.setThumbnail(avatarUrl);
            }

            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (subcommand === 'id') {
            const member = interaction.options.getUser('utente', true);
            await interaction.reply({
                embeds: [buildProfileEmbed(
                    'ID Utente',
                    `L'ID di **${member.username}** è \`${member.id}\``,
                    [{ name: 'Utente', value: `${member}`, inline: true }]
                )]
            });
        }
    }
};
