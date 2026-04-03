const { REST, Routes } = require('discord.js');
const config = require('../config/config');

const validModes = new Set(['global', 'guild', 'both']);
const mode = (process.argv[2] || 'both').toLowerCase();

if (!validModes.has(mode)) {
	console.error('Uso: node src/scripts/clearCommands.js [global|guild|both]');
	process.exit(1);
}

if (!config.token) {
	console.error('TOKEN mancante in src/config/.env');
	process.exit(1);
}

if ((mode === 'guild' || mode === 'both') && !config.guildId) {
	console.error('GUILD_ID mancante in src/config/.env');
	process.exit(1);
}

async function clearCommands() {
	const rest = new REST({ version: '10' }).setToken(config.token);
	const botUser = await rest.get(Routes.user());
	const appId = botUser.id;

	if (mode === 'global' || mode === 'both') {
		await rest.put(Routes.applicationCommands(appId), { body: [] });
		console.log('Comandi global ripuliti.');
	}

	if (mode === 'guild' || mode === 'both') {
		await rest.put(Routes.applicationGuildCommands(appId, config.guildId), { body: [] });
		console.log(`Comandi guild ripuliti per guild ${config.guildId}.`);
	}
}

clearCommands().catch((err) => {
	console.error('Errore durante la pulizia dei comandi:', err);
	process.exit(1);
});
