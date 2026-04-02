const { EmbedBuilder, ActionRowBuilder, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');
const path = require('node:path');
const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('../../../modules/tickets/constants')

async function ticketSetup(interaction, targetChannel) {

    const mainEmbed = new EmbedBuilder()
        .setColor(0xff7900)
        .setTitle(':ticket: Ticket')
        .setDescription("**Se hai bisogno di aiuto, apri un ticket selezionando una categoria dal menù a tendina qui sotto.**\n\n**Seleziona la categoria che meglio descrive il tuo problema/richiesta.**\n\n**Se non trovi la categoria adatta, seleziona 'Altro...'**\n\n - 🌍 **Candidatura Evento:** Candidati per prendere parte all'evento più imminente sul server\n\n - 📹 **Candidatura Content Creator:** Candidati per ottenere i privilegi da content creator\n\n - 🔧 **Candidatura Staff:** Candidati per entrare a far parte dello staff\n\n - ❓ **Aiuto o info:** Per aiuto o informazioni generali\n\n - 🎫 **Segnalazione di uno o più utenti:** Segnala uno o più utenti che non stanno rispettando il regolamento o bug abusando\n\n - ❕ **Altro...:** Per qualsiasi altra richiesta non elencata sopra")
        .setFooter({
            text: "LegoChris Ticket System",
            iconURL: interaction.guild?.iconURL({ dynamic: true, size: 1024 })
        })
        .setThumbnail(interaction.guild?.iconURL({ dynamic: true, size: 1024 }) ?? null)

    const options = ticketOptions.map(option =>
        new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setDescription(option.description)
        .setValue(option.value)
    );

    const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:select')
    .setPlaceholder('Seleziona il tipo di ticket')
    .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

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
        .setName('tickets-setup')
        .setDescription('Esegue il setup dei ticket sul server')
        .addChannelOption(option =>
            option
                .setName('canale')
                .setDescription('Canale dove inviare il pannello ticket')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('canale') || interaction.channel;

        await ticketSetup(interaction, targetChannel);
    }
};