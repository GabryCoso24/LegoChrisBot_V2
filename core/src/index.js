const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, MessageFlags } = require('discord.js');
const config = require('./config/config');
const { handleTicketInteraction } = require('../modules/tickets/interactionHandler');

if (!config.token) {
    throw new Error('Configurazione mancante: imposta TOKEN in src/config/.env');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ===== Carica comandi dinamicamente =====
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const getCommandFiles = dir => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getCommandFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
};

const commandFiles = getCommandFiles(commandsPath);

const activityTypeMap = {
    PLAYING: ActivityType.Playing,
    STREAMING: ActivityType.Streaming,
    LISTENING: ActivityType.Listening,
    WATCHING: ActivityType.Watching,
    COMPETING: ActivityType.Competing
};

function applyPresence() {
    const status = ['online', 'idle', 'dnd', 'invisible'].includes(config.presenceStatus)
        ? config.presenceStatus
        : 'online';
    const selectedType = activityTypeMap[(config.activityType || '').toUpperCase()] ?? ActivityType.Playing;

    client.user.setPresence({
        status,
        activities: [{
            name: config.activityText,
            type: selectedType
        }]
    });
}

for (const file of commandFiles) {
    const command = require(file);
    client.commands.set(command.data.name, command);
}

// ===== Event ready =====
client.once('clientReady', async () => {
    applyPresence();
    console.log(`Bot online come ${client.user.tag}`);

    await registerCommands();
});

// ===== Event interaction =====
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit()) {
            await handleTicketInteraction(interaction);
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('Errore durante l\'esecuzione');
        } else {
            await interaction.reply({
                content: 'Errore durante l\'esecuzione',
                flags: MessageFlags.Ephemeral
            });
        }
    }
});
// ===== Register slash commands =====
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(config.token);
    const cmds = commandFiles.map(file => require(file).data);
    await client.application.fetch();
    const appId = client.application?.id || client.user?.id;

    if (!appId) {
        throw new Error('Impossibile risolvere application id dal bot token');
    }

    if (config.clientId && config.clientId !== appId) {
        console.warn(`CLIENT_ID (${config.clientId}) non corrisponde al bot (${appId}). Uso ${appId}.`);
    }

    const route = config.guildId
        ? Routes.applicationGuildCommands(appId, config.guildId)
        : Routes.applicationCommands(appId);

    try {
        console.log("Registrazione comandi...");
        await rest.put(route, { body: cmds });
        console.log("Comandi registrati");
    } catch (err) { console.error(err); }
}

// ===== Avvio bot =====
(async () => {
    await client.login(config.token);
    
})();