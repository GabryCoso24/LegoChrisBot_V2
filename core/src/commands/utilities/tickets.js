const fs = require('fs');
const fsp = fs.promises;
const config = require('../../config/config');

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

const ticket_data = {
    persistentData: "./data/tickets/persistent_data.json",
    tickets: "./data/tickets/tickets.json",
    id_counter: "./data/tickets/ids.json"
};

const staffRoleId = config.staffRoleId;

async function folderExists(folderPath) {
    try {
        const stats = await fsp.stat(folderPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

if(!folderExists("../data")){
    fs.mkdir("../data")
    console.log("data dir created")
}

