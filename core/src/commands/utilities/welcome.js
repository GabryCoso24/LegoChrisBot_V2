const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_BANNER_PATH = path.resolve(process.cwd(), 'data', 'welcome', 'Benvenuto_MT.png');
const { SlashCommandBuilder, ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { hasHighStaffRole, replyRoleDenied } = require('../../lib/permissions');
const {
    getConfig,
    setChannel,
    setEnabled,
    setEmbedField,
    resetConfig,
    buildWelcomeEmbed,
    resolvePlaceholders,
    setMentionChannel
} = require('../../../modules/welcome/welcomeManager');

function buildWelcomeCommandEmbed(title, description, fields = [], color = 0xff7900) {
    return buildResponseEmbed({ title, description, fields, color });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Gestisce il sistema dei messaggi di benvenuto')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub
                .setName('setchannel')
                .setDescription('Imposta il canale dove inviare i messaggi di benvenuto')
                .addChannelOption(opt =>
                    opt
                        .setName('canale')
                        .setDescription('Canale di benvenuto')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('enable').setDescription('Abilita i messaggi di benvenuto')
        )
        .addSubcommand(sub =>
            sub.setName('disable').setDescription('Disabilita i messaggi di benvenuto')
        )
        .addSubcommandGroup(group =>
            group
                .setName('set')
                .setDescription('Configura l\'embed di benvenuto')
                .addSubcommand(sub =>
                    sub
                        .setName('title')
                        .setDescription('Imposta il titolo dell\'embed')
                        .addStringOption(opt =>
                            opt.setName('testo').setDescription('Titolo (supporta {user}, {username}, {server}, {memberCount})').setRequired(true).setMaxLength(256)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('description')
                        .setDescription('Imposta la descrizione dell\'embed')
                        .addStringOption(opt =>
                            opt.setName('testo').setDescription('Descrizione (supporta {user}, {username}, {server}, {memberCount}, {canale})').setRequired(true).setMaxLength(4096)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('color')
                        .setDescription('Imposta il colore dell\'embed (hex)')
                        .addStringOption(opt =>
                            opt.setName('colore').setDescription('Colore in formato hex (es. #ff7900 o ff7900)').setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('image')
                        .setDescription('Imposta l\'immagine banner dell\'embed (URL) oppure rimuovila')
                        .addStringOption(opt =>
                            opt.setName('url').setDescription('URL immagine, lascia "none" per rimuovere').setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('thumbnail')
                        .setDescription('Imposta la thumbnail dell\'embed (URL) oppure rimuovila')
                        .addStringOption(opt =>
                            opt.setName('url').setDescription('URL thumbnail, lascia "none" per rimuovere (default: icona server)').setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('footer')
                        .setDescription('Imposta il testo del footer dell\'embed')
                        .addStringOption(opt =>
                            opt.setName('testo').setDescription('Testo footer, lascia "none" per tornare al default').setRequired(true).setMaxLength(2048)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('mentioncanale')
                        .setDescription('Imposta il canale menzionato dal placeholder {canale} nella descrizione')
                        .addChannelOption(opt =>
                            opt
                                .setName('canale')
                                .setDescription('Canale da menzionare, lascia vuoto con "none" per rimuovere')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                                .setRequired(true)
                        )
                        .addBooleanOption(opt =>
                            opt.setName('rimuovi').setDescription('Imposta a true per rimuovere il canale mention').setRequired(false)
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('test').setDescription('Invia un messaggio di benvenuto di test nel canale configurato')
        )
        .addSubcommand(sub =>
            sub.setName('info').setDescription('Mostra la configurazione attuale del welcome')
        )
        .addSubcommand(sub =>
            sub.setName('reset').setDescription('Ripristina la configurazione di default del welcome')
        ),

    async execute(interaction) {
        if (!hasHighStaffRole(interaction)) {
            await replyRoleDenied(interaction, '❌ Il comando welcome è riservato all\'High Staff.');
            return;
        }

        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        // ── /welcome setchannel ──
        if (subcommand === 'setchannel') {
            const channel = interaction.options.getChannel('canale', true);
            await setChannel(channel.id);
            await interaction.reply({
                embeds: [buildWelcomeCommandEmbed(
                    '✅ Welcome — Canale impostato',
                    `Il canale di benvenuto è stato impostato su ${channel}.`
                )],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /welcome enable ──
        if (subcommand === 'enable') {
            await setEnabled(true);
            await interaction.reply({
                embeds: [buildWelcomeCommandEmbed('✅ Welcome — Abilitato', 'I messaggi di benvenuto sono ora **abilitati**.')],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /welcome disable ──
        if (subcommand === 'disable') {
            await setEnabled(false);
            await interaction.reply({
                embeds: [buildWelcomeCommandEmbed('⏸️ Welcome — Disabilitato', 'I messaggi di benvenuto sono ora **disabilitati**.', [], 0x808080)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /welcome set <field> ──
        if (group === 'set') {
            if (subcommand === 'title') {
                const text = interaction.options.getString('testo', true).replace(/\\n/g, '\n');
                await setEmbedField('title', text);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed('✅ Welcome — Titolo aggiornato', `Titolo impostato a:\n> ${text}`)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'description') {
                const text = interaction.options.getString('testo', true).replace(/\\n/g, '\n');
                await setEmbedField('description', text);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed('✅ Welcome — Descrizione aggiornata', `Descrizione aggiornata con successo.`)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'color') {
                const raw = interaction.options.getString('colore', true).replace('#', '');
                const parsed = parseInt(raw, 16);
                if (isNaN(parsed) || raw.length !== 6) {
                    await interaction.reply({
                        embeds: [buildWelcomeCommandEmbed('❌ Welcome — Colore non valido', 'Usa un colore hex valido, es. `ff7900` o `#ff7900`.', [], 0xff4d4d)],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                await setEmbedField('color', parsed);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed('✅ Welcome — Colore aggiornato', `Colore impostato a **#${raw.toLowerCase()}**.`).setColor(parsed)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'image') {
                const url = interaction.options.getString('url', true);
                const value = url.toLowerCase() === 'none' ? null : url;
                await setEmbedField('imageUrl', value);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed(
                        '✅ Welcome — Immagine aggiornata',
                        value ? `Immagine banner impostata.` : 'Immagine banner rimossa.'
                    )],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'thumbnail') {
                const url = interaction.options.getString('url', true);
                const value = url.toLowerCase() === 'none' ? null : url;
                await setEmbedField('thumbnailUrl', value);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed(
                        '✅ Welcome — Thumbnail aggiornata',
                        value ? `Thumbnail impostata.` : 'Thumbnail rimossa (verrà usata l\'icona del server).'
                    )],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'footer') {
                const raw = interaction.options.getString('testo', true);
                const value = raw.toLowerCase() === 'none' ? null : raw.replace(/\\n/g, '\n');
                await setEmbedField('footerText', value);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed(
                        '✅ Welcome — Footer aggiornato',
                        value ? `Footer impostato a:\n> ${value}` : 'Footer ripristinato al default.'
                    )],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'mentioncanale') {
                const rimuovi = interaction.options.getBoolean('rimuovi') ?? false;
                if (rimuovi) {
                    await setMentionChannel(null);
                    await interaction.reply({
                        embeds: [buildWelcomeCommandEmbed('✅ Welcome — Canale mention rimosso', 'Il placeholder `{canale}` non punterà più a nessun canale.')],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                const mentionCh = interaction.options.getChannel('canale', true);
                await setMentionChannel(mentionCh.id);
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed(
                        '✅ Welcome — Canale mention impostato',
                        `Il placeholder \`{canale}\` verrà sostituito con ${mentionCh} nella descrizione del welcome.`
                    )],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        // ── /welcome test ──
        if (subcommand === 'test') {
            const config = getConfig();

            if (!config.channelId) {
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed('❌ Welcome — Test fallito', 'Nessun canale di benvenuto configurato. Usa `/welcome setchannel` prima.', [], 0xff4d4d)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const channel = interaction.guild.channels.cache.get(config.channelId);
            if (!channel) {
                await interaction.reply({
                    embeds: [buildWelcomeCommandEmbed('❌ Welcome — Test fallito', 'Il canale configurato non è più accessibile.', [], 0xff4d4d)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const testMember = interaction.member;
            const embed = buildWelcomeEmbed(config.embed, testMember, config);
            const payload = { embeds: [embed] };

            // Aggiungi il banner default se non c'è un'immagine custom
            if (!config.embed.imageUrl && fs.existsSync(DEFAULT_BANNER_PATH)) {
                payload.files = [DEFAULT_BANNER_PATH];
                embed.setImage('attachment://Benvenuto_MT.png');
            }

            await channel.send(payload);

            await interaction.reply({
                embeds: [buildWelcomeCommandEmbed('✅ Welcome — Test inviato', `Messaggio di test inviato in ${channel}.`)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /welcome info ──
        if (subcommand === 'info') {
            const config = getConfig();
            const channelMention = config.channelId ? `<#${config.channelId}>` : '`Non impostato`';
            const colorHex = `#${(config.embed.color ?? 0xff7900).toString(16).padStart(6, '0')}`;

            const fields = [
                { name: '📡 Stato', value: config.enabled ? '✅ Abilitato' : '⏸️ Disabilitato', inline: true },
                { name: '📢 Canale', value: channelMention, inline: true },
                { name: '🔔 Canale mention', value: config.mentionChannelId ? `<#${config.mentionChannelId}>` : '`Non impostato`', inline: true },
                { name: '🎨 Colore', value: colorHex, inline: true },
                { name: '📝 Titolo', value: config.embed.title ?? '*(nessuno)*', inline: false },
                { name: '📄 Descrizione', value: config.embed.description ?? '*(nessuna)*', inline: false },
                { name: '🖼️ Thumbnail', value: config.embed.thumbnailUrl ?? '*(icona server)*', inline: true },
                { name: '🖼️ Immagine', value: config.embed.imageUrl ?? '*(nessuna)*', inline: true },
                { name: '📎 Footer', value: config.embed.footerText ?? '*(default: LegoChris Bot)*', inline: false },
                { name: '💡 Placeholders', value: '`{user}` `{username}` `{server}` `{memberCount}` `{canale}`', inline: false }
            ];

            await interaction.reply({
                embeds: [buildWelcomeCommandEmbed('📋 Welcome — Configurazione', 'Ecco la configurazione attuale del modulo welcome:', fields)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // ── /welcome reset ──
        if (subcommand === 'reset') {
            await resetConfig();
            await interaction.reply({
                embeds: [buildWelcomeCommandEmbed('🔄 Welcome — Reset effettuato', 'La configurazione del welcome è stata ripristinata ai valori di default.\n⚠️ Il canale di benvenuto è stato rimosso, ricorda di reimpostarlo con `/welcome setchannel`.')],
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }
};
