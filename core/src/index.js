const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, MessageFlags, Partials } = require('discord.js');
const config = require('./config/config');
const { handleTicketInteraction } = require('../modules/tickets/interactionHandler');
const { handleReactionRoleAdd, handleReactionRoleRemove } = require('../modules/reactionRoles/reactionRolesManager');
const { handleAiMessage } = require('../modules/ai/aiMessageHandler');
const { handleTtsMessage } = require('../modules/ttsClassic/ttsMessageHandler');

if (!config.token) {
    throw new Error('Missing configuration: set TOKEN in src/config/.env');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// ===== Load commands dynamically =====
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

// ===== Ready event =====
client.once('clientReady', async () => {
    applyPresence();
    console.log(`Bot online as ${client.user.tag}`);

    await registerCommands();
});

// ===== Interaction event =====
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit()) {
            await handleTicketInteraction(interaction);
            return;
        }

        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;
            await command.autocomplete(interaction);
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: 'Error during execution' }).catch(() => null);
        } else {
            await interaction.reply({
                content: 'Error during execution',
                flags: MessageFlags.Ephemeral
            }).catch(() => null);
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    try {
        await handleReactionRoleAdd(reaction, user);
    } catch (err) {
        console.error(err);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    try {
        await handleReactionRoleRemove(reaction, user);
    } catch (err) {
        console.error(err);
    }
});

client.on('messageCreate', async message => {
    try {
        await handleTtsMessage(message);
        await handleAiMessage(message);
    } catch (err) {
        console.error(err);
    }
});
// ===== Register slash commands =====
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(config.token);
    const cmds = commandFiles.map(file => require(file).data);
    await client.application.fetch();
    const appId = client.application?.id || client.user?.id;

    if (!appId) {
        throw new Error('Unable to resolve application id from bot token');
    }

    if (config.clientId && config.clientId !== appId) {
        console.warn(`CLIENT_ID (${config.clientId}) does not match bot (${appId}). Using ${appId}.`);
    }

    const route = config.guildId
        ? Routes.applicationGuildCommands(appId, config.guildId)
        : Routes.applicationCommands(appId);

    try {
        console.log("Registering commands...");
        await rest.put(route, { body: cmds });
        console.log("Commands registered");
    } catch (err) { console.error(err); }
}

// ===== Start bot =====
(async () => {
    await client.login(config.token);
    
})();