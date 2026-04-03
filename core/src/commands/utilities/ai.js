const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');
const { connectToChannel, getConnectedChannelId } = require('../../../modules/ai/aiVoiceManager');
const { enableTts, disableTts, isTtsEnabled } = require('../../../modules/ai/aiState');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Gestisce l\'assistente AI')
        .addSubcommand(sub =>
            sub
                .setName('join')
                .setDescription('Il bot entra nel tuo canale vocale')
        )
        .addSubcommand(sub =>
            sub
                .setName('mode')
                .setDescription('Attiva o disattiva la modalita AI vocale su ping')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const voiceChannel = interaction.member?.voice?.channel || null;

        try {
            if (subcommand === 'join') {
                if (!voiceChannel) {
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'AI Voice',
                            description: 'Devi essere in un canale vocale.'
                        })],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await connectToChannel(interaction, voiceChannel);
                enableTts(interaction.guild.id);

                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'AI Voice',
                        description: `Bot connesso a ${voiceChannel.name}. Modalita AI vocale attiva di default.`
                    })]
                });
                return;
            }

            if (subcommand === 'mode') {
                const connectedChannelId = getConnectedChannelId(interaction.guild.id);
                if (!connectedChannelId) {
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'AI Voice',
                            description: 'Prima usa /ai join mentre sei in un canale vocale.'
                        })],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (isTtsEnabled(interaction.guild.id)) {
                    disableTts(interaction.guild.id);
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'AI Voice',
                            description: 'Modalita AI vocale disattivata.'
                        })]
                    });
                } else {
                    enableTts(interaction.guild.id);
                    await interaction.reply({
                        embeds: [buildResponseEmbed({
                            title: 'AI Voice',
                            description: 'Modalita AI vocale attivata: quando mi pinghi in chat rispondo in testo e in vocale.'
                        })]
                    });
                }
            }
        } catch (error) {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [buildResponseEmbed({
                        title: 'AI',
                        description: `Errore AI: ${error.message}`
                    })]
                }).catch(() => null);
            } else {
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'AI',
                        description: `Errore AI: ${error.message}`
                    })],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            }
        }
    }
};
