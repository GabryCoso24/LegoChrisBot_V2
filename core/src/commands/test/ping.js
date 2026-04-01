// src/commands/ping.js
module.exports = {
    data: {
        name: "pingjs",
        description: "Risponde con pong"
    },
    async execute(interaction) {
        await interaction.reply("pong 🏓");
    }

};

console.log("ping pronto")