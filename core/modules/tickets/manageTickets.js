const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('./constants')
const { ChannelType, MessageFlags, PermissionFlagsBits, PermissionOverwrites } = require('discord.js')
const { nextTicketId, saveTicket, getTicket, getTicketByChannel, getOpenTicketByUser, updateTicket} = require("./storage")

const guild = interaction.guild;
const creatorId = interaction.user.id;
const everyoneId = guild.roles.everyone.id;
const ticketPermissions = [
    {
        id: everyoneId,
        deny: [PermissionFlagsBits.ViewChannel],
    },
    {
        id: creatorId,
        allow: [PermissionFlagsBits.ViewChannel],
    },
    {
        id: staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
    }
];

async function ticketCreate(interaction){
    const userChoice = interaction.values[0];
    const selectedOption = ticketOptions.find(opt => opt.value === userChoice);
    if (!selectedOption) {
        await interaction.reply({ content: 'Opzione non valida.', flags: MessageFlags.Ephemeral });
        return;
    }
    const ticketCategory = selectedOption.ticketCategory;
    const creatorUsername = interaction.user.username;
    if(!(await categoryExistsByName(guild, ticketCategory)) &&
        !(await channelExistsByName(guild, `ticket-${creatorUsername}`))){
        const categoryChannel = await guild.channels.create({
            name: ticketCategory,
            type: ChannelType.GuildCategory,
            PermissionOverwrites : ticketPermissions
        });
        await guild.channels.create({
            name: `ticket-${creatorUsername}`,
            type: ChannelType.GuildText,
            parent: categoryChannel.id,
        });
    } else if(await categoryExistsByName(guild, ticketCategory)){
        await interaction.guild.channels.create({
            name: `ticket-${creatorUsername}`,
            type: ChannelType.GuildText,
            parent: categoryChannel.id,
            PermissionOverwrites: ticketPermissions
        });
    } else {
        const existingTicketChannel = guild.channels.cache.find(
            ch => ch.name.toLowerCase() === `ticket-${creatorUsername}`.toLowerCase() && 
                ch.type === ChannelType.GuildText
        );
        await interaction.send({
            content: `Hai già un ticket aperto in ${existingTicketChannel}`,
            flags: MessageFlags.Ephemeral
        })
    }

    const ticketId = await nextTicketId();
    const ticketKey = `ticket-${interaction.user.id}-${ticketId}`;

    const ticketRecord = {
        id: ticketId,
        user_id: interaction.user.id,
        username: interaction.user.username,
        category: selectedOption.ticketCategory,
        channel_id: ticketChannel.id,
        message_id: null,
        claimed_by: null,
        closed_by: null,
        created_at: new Date().toISOString(),
        closed_at: null,
        reason: selectedOption.description,
        button_data: {
            claim_button: false,
            close_with_reason_button: false
        }
    };

    await saveTicket(ticketKey, ticketRecord);
}

module.exports = {
    ticketCreate
}