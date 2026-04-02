const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('./constants')
const { ChannelType, MessageFlags } = require('discord.js')
const { ticketCreate } = require('./manageTickets')

async function handleTicketInteraction(interaction) {
    if (interaction.isStringSelectMenu()) {
        switch (interaction.customId) {
            case 'ticket:select':
                ticketCreate(interaction)
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

async function channelExistsByName(guild, name) {
  await guild.channels.fetch(); // assicura cache aggiornata
  const normalized = name.trim().toLowerCase();

  return guild.channels.cache.some(
    ch => ch.name.toLowerCase() === normalized && ch.type === ChannelType.GuildText
  );
}

async function categoryExistsByName(guild, name) {
  await guild.channels.fetch();
  const normalized = name.trim().toLowerCase();

  return guild.channels.cache.some(
    ch => ch.name.toLowerCase() === normalized && ch.type === ChannelType.GuildCategory
  );
}

module.exports = {
    handleTicketInteraction
};