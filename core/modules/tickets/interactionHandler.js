const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('./constants')

async function handleTicketInteraction(interaction) {
    if (interaction.isStringSelectMenu()) {
        switch (interaction.customId) {
            case 'ticket:select':
                const scelta = interaction.values[0];
                switch (scelta) {
                    case 'candidatura_evento':
                        await interaction.reply({ content: 'ciao', ephemeral: true });
                        break;

                    case 'candidatura_staff':
                        await interaction.reply({ content: 'ciao', ephemeral: true });
                        break;

                    case 'aiuto_info':
                        await interaction.reply({ content: 'ciao', ephemeral: true });
                        break;

                    default:
                        await interaction.reply({ content: 'ciao', ephemeral: true });
                        break;
                }
                return;

            default:
                return;
        }
    }

    if (interaction.isButton()) {
        switch (interaction.customId) {
            case 'ticket:close':
                // chiusura ticket
                return;

            case 'ticket:claim':
                // presa in carico ticket
                return;

            case 'ticket:delete':
                // eliminazione ticket
                return;

            default:
                return;
        }
    }
}

module.exports = {
    handleTicketInteraction
};