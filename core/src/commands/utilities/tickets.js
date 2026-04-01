const { EmbedBuilder, ActionRowBuilder, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');
const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('../../../modules/tickets/constants')

async function ticketSetup(interaction, targetChannel) {

    const exampleEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Setup Ticket')
        .setDescription('Seleziona il tipo di ticket dal menu qui sotto.')

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

    await targetChannel.send({
        embeds: [exampleEmbed],
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

        // qui userai force per decidere se reinviare il pannello
        await ticketSetup(interaction, targetChannel);
    }
};