const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const { buildResponseEmbed } = require('../../lib/responseEmbed');

function buildReactionRolesMessageEmbed() {
    return buildResponseEmbed({
        title: '🎭 Reaction Roles',
        description: 'Reagisci con le emoji qui sotto per ottenere i ruoli corrispondenti!',
        fields: [
            { name: ':male_sign: Maschio', value: 'Ruolo per identificarsi come maschio', inline: false },
            { name: ':female_sign: Femmina', value: 'Ruolo per identificarsi come femmina', inline: false },
            { name: ':transgender_symbol: Femboy', value: 'Ruolo per identificarsi come femboy', inline: false },
            { name: ':globe_with_meridians: Ping Eventi', value: 'Ruolo per ricevere notifiche sugli eventi', inline: false },
            { name: ':red_circle: Ping Live', value: 'Ruolo per ricevere notifiche sulle live', inline: false }
        ]
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Invia un messaggio embed prestabilito in un canale specifico')
        .addStringOption(option =>
            option
                .setName('tipo')
                .setDescription('Tipo di messaggio da inviare')
                .setRequired(true)
                .addChoices({ name: 'reaction_roles', value: 'reaction_roles' })
        )
        .addChannelOption(option =>
            option
                .setName('canale')
                .setDescription('Canale dove inviare il messaggio')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const tipo = interaction.options.getString('tipo', true);
        const canale = interaction.options.getChannel('canale', true);

        try {
            let embed;

            if (tipo === 'reaction_roles') {
                embed = buildReactionRolesMessageEmbed();
            } else {
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'Message',
                        description: 'Tipo di messaggio non valido.'
                    })],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await canale.send({ embeds: [embed] });

            await interaction.reply({
                embeds: [buildResponseEmbed({
                    title: 'Message',
                    description: `Messaggio '${tipo}' inviato con successo in ${canale}!`
                })],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            if (error.code === 50013) {
                await interaction.reply({
                    embeds: [buildResponseEmbed({
                        title: 'Message',
                        description: 'Non ho i permessi per inviare messaggi in quel canale.'
                    })],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.reply({
                embeds: [buildResponseEmbed({
                    title: 'Message',
                    description: `Errore nell'invio del messaggio: ${error.message}`
                })],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
