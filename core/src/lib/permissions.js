const { MessageFlags } = require('discord.js');
const config = require('../config/config');
const { buildResponseEmbed } = require('./responseEmbed');

function hasStaffRole(interaction) {
    return Boolean(
        config.staffRoleId
        && interaction.inGuild()
        && interaction.member?.roles?.cache?.has(config.staffRoleId)
    );
}

function hasHighStaffRole(interaction) {
    return Boolean(
        config.highStaffRoleId
        && interaction.inGuild()
        && interaction.member?.roles?.cache?.has(config.highStaffRoleId)
    );
}

async function replyRoleDenied(interaction, message) {
    const payload = {
        embeds: [buildResponseEmbed({
            title: 'Permessi',
            description: message
        })],
        flags: MessageFlags.Ephemeral
    };

    if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
        return;
    }

    await interaction.reply(payload).catch(() => null);
}

module.exports = {
    hasStaffRole,
    hasHighStaffRole,
    replyRoleDenied
};
