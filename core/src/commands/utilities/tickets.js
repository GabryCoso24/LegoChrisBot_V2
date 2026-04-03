const { EmbedBuilder, SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const path = require('node:path');
const { ticketOptions } = require('../../../modules/tickets/constants');
const { ticketClaim, getTicketChannels, ticketClose } = require('../../../modules/tickets/manageTickets');

async function ticketSetup(interaction, targetChannel) {
    const { buildTicketSelectRow } = require('../../../modules/tickets/manageTickets');

    const mainEmbed = new EmbedBuilder()
        .setColor(0xff7900)
        .setTitle(':ticket: Ticket')
        .setDescription("**Se hai bisogno di aiuto, apri un ticket selezionando una categoria dal menù a tendina qui sotto.**\n\n**Seleziona la categoria che meglio descrive il tuo problema/richiesta.**\n\n**Se non trovi la categoria adatta, seleziona 'Altro...'**\n\n - 🌍 **Candidatura Evento:** Candidati per prendere parte all'evento più imminente sul server\n\n - 📹 **Candidatura Content Creator:** Candidati per ottenere i privilegi da content creator\n\n - 🔧 **Candidatura Staff:** Candidati per entrare a far parte dello staff\n\n - ❓ **Aiuto o info:** Per aiuto o informazioni generali\n\n - 🎫 **Segnalazione di uno o più utenti:** Segnala uno o più utenti che non stanno rispettando il regolamento o bug abusando\n\n - ❕ **Altro...:** Per qualsiasi altra richiesta non elencata sopra")
        .setFooter({
            text: "LegoChris Ticket System",
            iconURL: interaction.guild?.iconURL({ dynamic: true, size: 1024 })
        })
        .setThumbnail(interaction.guild?.iconURL({ dynamic: true, size: 1024 }) ?? null)
    
    const row = buildTicketSelectRow(ticketOptions)

    const ticketImagePath = path.join(__dirname, '../../../data/tickets/Tickets_MT.png');
    await targetChannel.send({ files: [ticketImagePath] });

    await targetChannel.send({
        embeds: [mainEmbed],
        components: [row]
    });

    await interaction.reply({
        content: `Setup inviato in ${targetChannel}.`,
        flags: MessageFlags.Ephemeral
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Gestisce il sistema dei tickets')
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Esegue il setup dei ticket')
                .addChannelOption(option =>
                    option
                        .setName('canale')
                        .setDescription('Canale dove inviare il pannello ticket')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('claim')
                .setDescription('Permette di claimare un ticket anche al di fuori di esso')
                .addChannelOption(option =>
                    option
                        .setName('canale')
                        .setDescription('Canale ticket da claimare')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('close')
                .setDescription('Permette di chiudere un ticket anche al di fuori di esso')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Motivo della chiusura')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('canale')
                        .setDescription('Canale ticket da chiudere')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            const targetChannel = interaction.options.getChannel('canale') || interaction.channel;
            await ticketSetup(interaction, targetChannel);
        } else if (subcommand === 'claim') {
            const ticketChannel = interaction.options.getChannel('canale');
            await ticketClaim(interaction, ticketChannel);
        } else if (subcommand === 'close'){
            const ticketChannel = interaction.options.getChannel('canale');
            const reason = interaction.options.getString('reason', true);
            await ticketClose(interaction, ticketChannel, reason);
        }
    },

    async autocomplete(interaction) {
        if (interaction.commandName === 'ticket' && interaction.options.getSubcommand() === 'claim') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            
            // Use the helper function to get ticket channels
            const ticketChannels = getTicketChannels(interaction.guild);

            // Filter by provided value
            const filtered = ticketChannels.filter(ch => 
                ch.name.toLowerCase().includes(focusedValue)
            ).slice(0, 25);

            await interaction.respond(filtered);
        }
    }
};