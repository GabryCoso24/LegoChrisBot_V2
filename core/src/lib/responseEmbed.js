const { EmbedBuilder } = require('discord.js');

function buildResponseEmbed({ title, description, fields = [], color = 0xff7900 }) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setFooter({ text: 'LegoChris Bot' })
        .setTimestamp();

    if (title) {
        embed.setTitle(title);
    }

    if (description) {
        embed.setDescription(description);
    }

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

module.exports = {
    buildResponseEmbed
};
