const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('./constants')
const { ChannelType, MessageFlags } = require('discord.js')
const { ticketCreate, ticketClose, handleCloseTicketModal } = require('./manageTickets')

async function handleTicketInteraction(interaction) {
    if (interaction.isModalSubmit()) {
        switch (interaction.customId) {
            case 'closeTicketModal':
                await handleCloseTicketModal(interaction);
                return;
            default:
                return;
        }
    }

    if (interaction.isStringSelectMenu()) {
        switch (interaction.customId) {
            case 'ticket:select':
                await ticketCreate(interaction)
                return;
            default:
                return;
        }
    }

    if (interaction.isButton()) {
        switch (interaction.customId) {
            case 'ticket:close':
                await ticketClose(interaction)
                return;

            case 'ticket:claim':
                // presa in carico ticket
                return;
            default:
                return;
        }
    }
}


module.exports = {
    handleTicketInteraction
};