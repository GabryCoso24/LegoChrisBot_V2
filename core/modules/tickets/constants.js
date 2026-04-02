const config = require('../../src/config/config');
const { ButtonStyle } = require('discord.js');

const tickets = {
    categoryName: "🎫 | ----- | Supporto | ----- | 🎫",
    channelName: "「🎫」ticket",
    logsCategory: "🔧 | ----- | Logs | ----- | 🔧",
    logsChannel: "「📥」ticket-logs"
};

const ticketOptions = [
    {
        label: "🌍 Candidatura Evento",
        ticketCategory: "Candidatura Evento",
        description: "Candidati per prendere parte all'evento più imminente sul server",
        value: "candidatura_evento"
    },
    {   
        label: "📹 Candidatura Content Creator",
        ticketCategory: "Candidatura Content Creator",
        description: "Candidati per ottenere i privilegi da content creator",
        value: "candidatura_content_creator"
    },
    {
        label: "🔧 Candidatura Staff",
        ticketCategory: "Candidatura Staff",
        description: "Candidati per entrare a far parte dello staff",
        value: "candidatura_staff"
    },
    {
        label: "❓ Aiuto o info",
        ticketCategory: "Aiuto o info",
        description: "Per aiuto o informazioni generali",
        value: "aiuto_o_info",
    },
    {
        label: "🎫 Segnalazione di uno o più utenti",
        ticketCategory: "Segnalazione di uno o più utenti",
        description: "Segnala uno o più utenti che non stanno rispettando il regolamento o bug abusando",
        value: "segnalazione"
    },
    {
        label: "❕ Altro...",
        ticketCategory: "Altro",
        description: "Per qualsiasi altra richiesta non elencata sopra",
        value: "altro"
    }
];

const ticketActions = [
    {
        label: "🙋 Claim",
        value: 'ticket:claim',
        style: ButtonStyle.Success
    },
    {
        label: "🔒 Chiudi",
        value: 'ticket:close',
        style: ButtonStyle.Danger
    }
]

const ticketDataFiles = {
    tickets: "./data/tickets/tickets.json",
    id_counter: "./data/tickets/ids.json"
};

const staffRoleId = config.staffRoleId;

module.exports = {
    tickets, ticketOptions, ticketDataFiles, staffRoleId, ticketActions   
};