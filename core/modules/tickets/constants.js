const config = require('../../src/config/config');

const tickets = {
    categoryName: "🎫 | ----- | Supporto | ----- | 🎫",
    channelName: "「🎫」ticket",
    logsCategory: "🔧 | ----- | Logs | ----- | 🔧",
    logsChannel: "「📥」ticket-logs"
};

const ticketOptions = {
    "🌍 Candidatura Evento": "Candidatura Evento",
    "📹 Candidatura Content Creator": "Candidatura Content Creator",
    "🔧 Candidatura Staff": "Candidatura Staff",
    "❓ Aiuto o info": "Aiuto o info",
    "🎫 Segnalazione di uno o più utenti": "Segnalazione di uno o più utenti",
    "❕ Altro...": "Altro"
};

const ticketDataFiles = {
    persistentData: "./data/tickets/persistent_data.json",
    tickets: "./data/tickets/tickets.json",
    id_counter: "./data/tickets/ids.json"
};

const staffRoleId = config.staffRoleId;

module.exports = {
    tickets, ticketOptions, ticketDataFiles, staffRoleId   
};