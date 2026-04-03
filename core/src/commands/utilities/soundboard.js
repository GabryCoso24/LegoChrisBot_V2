const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const soundboard = require('../../services/soundboardVoiceManager');
const { buildResponseEmbed } = require('../../lib/responseEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soundboard')
        .setDescription('Controlla la soundboard audio service')
        .addSubcommand(sub =>
            sub
                .setName('playsound')
                .setDescription('Aggiunge un suono alla coda')
                .addStringOption(option =>
                    option
                        .setName('nome')
                        .setDescription('Nome suono con o senza estensione')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('canale')
                        .setDescription('Canale vocale di destinazione (opzionale)')
                        .addChannelTypes(ChannelType.GuildVoice)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('skip')
                .setDescription('Salta il suono in riproduzione')
        )
        .addSubcommand(sub =>
            sub
                .setName('stop')
                .setDescription('Ferma la riproduzione e svuota la coda')
        )
        .addSubcommand(sub =>
            sub
                .setName('queue')
                .setDescription('Mostra lo stato della coda')
        )
        .addSubcommand(sub =>
            sub
                .setName('listsounds')
                .setDescription('Elenca i suoni disponibili')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'playsound') {
                await interaction.deferReply();
                const soundName = interaction.options.getString('nome', true);
                const targetChannel = interaction.options.getChannel('canale');

                const queued = await soundboard.queueSound(interaction, soundName, targetChannel);

                await interaction.editReply({
                    embeds: [buildResponseEmbed({
                        title: 'Soundboard',
                        description: `Suono ${queued.name} aggiunto in coda (id: ${queued.id}).`
                    })]
                });
                return;
            }

            if (subcommand === 'skip') {
                const skipped = soundboard.skip(interaction.guildId);
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'Soundboard',
                        description: skipped ? 'Suono saltato.' : 'Nessun suono in riproduzione.'
                    })]
                });
                return;
            }

            if (subcommand === 'stop') {
                const stopped = soundboard.stop(interaction.guildId);
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'Soundboard',
                        description: stopped ? 'Riproduzione fermata e coda svuotata.' : 'Nessuna sessione audio attiva.'
                    })]
                });
                return;
            }

            if (subcommand === 'queue') {
                const status = soundboard.queue(interaction.guildId);
                const now = status.nowPlaying
                    ? `In riproduzione: ${status.nowPlaying.name}`
                    : 'In riproduzione: nessuno';
                const pending = status.pending?.length
                    ? status.pending.map((item, index) => `${index + 1}. ${item.name}`).join('\n')
                    : 'Coda vuota';

                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'Soundboard Queue',
                        fields: [
                            { name: 'Stato', value: now, inline: false },
                            { name: 'Coda', value: pending, inline: false }
                        ]
                    })]
                });
                return;
            }

            if (subcommand === 'listsounds') {
                await interaction.deferReply();
                const sounds = soundboard.listSounds();
                const content = sounds.length
                    ? sounds.map((sound, index) => `${index + 1}. ${sound}`).join('\n')
                    : 'Nessun suono disponibile.';

                await interaction.editReply({
                    embeds: [buildResponseEmbed({
                        title: 'Soundboard - Suoni disponibili',
                        description: content.slice(0, 3900)
                    })]
                });
            }
        } catch (error) {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [buildResponseEmbed({
                        title: 'Errore audio service',
                        description: error.message,
                        color: 0xff4d4d
                    })]
                });
            } else {
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'Errore audio service',
                        description: error.message,
                        color: 0xff4d4d
                    })]
                });
            }
        }
    }
};
