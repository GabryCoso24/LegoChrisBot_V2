const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { generateTts } = require('../../../modules/ai/aiServiceClient');
const { connectToChannel, disconnect, getConnectedChannelId } = require('../../../modules/ai/aiVoiceManager');
const { enableReader, disableReader, getReaderState, isReaderEnabled } = require('../../../modules/ttsClassic/ttsReaderState');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('Strumenti TTS')
        .addSubcommand(sub =>
            sub
                .setName('text')
                .setDescription('Genera un file audio da un testo')
                .addStringOption(option =>
                    option
                        .setName('testo')
                        .setDescription('Testo da convertire in audio')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('join')
                .setDescription('Entra in vocale e legge i messaggi degli utenti mutati')
        )
        .addSubcommand(sub =>
            sub
                .setName('mode')
                .setDescription('Attiva o disattiva la lettura TTS chat')
        )
        .addSubcommand(sub =>
            sub
                .setName('leave')
                .setDescription('Disattiva lettura TTS chat ed esce dalla vocale')
        )
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Mostra stato lettura TTS chat')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const voiceChannel = interaction.member?.voice?.channel || null;

        try {
            if (subcommand === 'text') {
                await interaction.deferReply();
                const text = interaction.options.getString('testo', true);
                const tts = await generateTts(text);
                const audioBuffer = Buffer.from(tts.audio_base64, 'base64');

                await interaction.editReply({
                    embeds: [buildResponseEmbed({
                        title: 'TTS',
                        description: 'Ecco il file audio generato.'
                    })],
                    files: [
                        {
                            attachment: audioBuffer,
                            name: tts.file_name || `tts-${Date.now()}.wav`
                        }
                    ]
                });
                return;
            }

            if (subcommand === 'join') {
                if (!voiceChannel) {
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'TTS',
                            description: 'Devi essere in un canale vocale.'
                        })],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await connectToChannel(interaction, voiceChannel);
                enableReader(interaction.guild.id, voiceChannel.id);

                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'TTS',
                        description: `TTS chat attivato in ${voiceChannel.name}. Modalita attiva di default.`
                    })]
                });
                return;
            }

            if (subcommand === 'mode') {
                const connectedChannelId = getConnectedChannelId(interaction.guild.id);
                if (!connectedChannelId) {
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'TTS',
                            description: 'Prima usa /tts join mentre sei in un canale vocale.'
                        })],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (isReaderEnabled(interaction.guild.id)) {
                    disableReader(interaction.guild.id);
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'TTS',
                            description: 'Modalita TTS chat disattivata.'
                        })]
                    });
                } else {
                    enableReader(interaction.guild.id, connectedChannelId);
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'TTS',
                            description: 'Modalita TTS chat attivata.'
                        })]
                    });
                }
                return;
            }

            if (subcommand === 'leave') {
                disableReader(interaction.guild.id);
                disconnect(interaction.guild.id);

                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'TTS',
                        description: 'TTS chat disattivato e bot disconnesso dalla vocale.'
                    })]
                });
                return;
            }

            if (subcommand === 'status') {
                const state = getReaderState(interaction.guild.id);
                const connectedChannelId = getConnectedChannelId(interaction.guild.id);
                const enabled = Boolean(state?.enabled);

                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'TTS',
                        description: `TTS chat: ${enabled ? 'attivo' : 'disattivo'}${connectedChannelId ? ` | channelId: ${connectedChannelId}` : ''}`
                    })],
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [buildResponseEmbed({
                        title: 'TTS',
                        description: `Errore TTS: ${error.message}`
                    })]
                }).catch(() => null);
            } else {
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'TTS',
                        description: `Errore TTS: ${error.message}`
                    })],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            }
        }
    }
};
