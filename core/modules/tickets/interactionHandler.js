const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('./constants')
const { ChannelType, MessageFlags } = require('discord.js')
const { ticketCreate, ticketClose, handleCloseTicketModal, ticketClaim } = require('./manageTickets')

async function handleTicketInteraction(interaction) {
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('closeTicketModal:')) {
            await handleCloseTicketModal(interaction);
            return;
        }
        return;
    }

    if (interaction.isStringSelectMenu()) {
        switch (interaction.customId) {
            case 'ticket:select':
                await ticketCreate(interaction);
                return;
            default:
                return;
        }
    }

    if (interaction.isButton()) {
        switch (interaction.customId) {
            case 'ticket:close':
                await ticketClose(interaction);
                return;

            case 'ticket:claim':
                await ticketClaim(interaction);
                return;
            default:
                return;
        }
    }
}


module.exports = {
    handleTicketInteraction
};