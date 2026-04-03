const fs = require('node:fs');
const path = require('node:path');
const { MessageFlags } = require('discord.js');

const dataPath = path.resolve(process.cwd(), 'data', 'reactionroles', 'reactionroles.json');
let messageIdToRoles = loadReactionRoles();

function loadReactionRoles() {
    if (!fs.existsSync(dataPath)) {
        return {};
    }

    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(raw);
        const reactionRoles = data.reaction_roles ?? {};

        return Object.fromEntries(
            Object.entries(reactionRoles).map(([messageId, emojiMap]) => [
                Number(messageId),
                { ...emojiMap }
            ])
        );
    } catch (error) {
        console.error('Errore nel caricamento reaction roles:', error);
        return {};
    }
}

function saveReactionRoles() {
    const payload = {
        reaction_roles: Object.fromEntries(
            Object.entries(messageIdToRoles).map(([messageId, emojiMap]) => [messageId, emojiMap])
        )
    };

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function setReactionRole(interaction, messageId, emoji, role) {
    const messageIdInt = Number(messageId);
    if (!Number.isInteger(messageIdInt)) {
        await interaction.reply({ content: '❌ ID messaggio non valido.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (!messageIdToRoles[messageIdInt]) {
        messageIdToRoles[messageIdInt] = {};
    }

    messageIdToRoles[messageIdInt][emoji] = role.id;
    saveReactionRoles();

    try {
        const channel = interaction.channel;
        const message = await channel.messages.fetch(messageIdInt);
        await message.react(emoji);

        await interaction.reply({
            content: `✅ Reaction role impostato: ${emoji} → ${role.mention} (reazione aggiunta al messaggio)`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        await interaction.reply({
            content: `✅ Reaction role impostato: ${emoji} → ${role.mention}\n⚠️ Non sono riuscito ad aggiungere la reazione in automatico: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

async function removeReactionRole(interaction, messageId, emoji) {
    const messageIdInt = Number(messageId);
    if (!Number.isInteger(messageIdInt)) {
        await interaction.reply({ content: '❌ ID messaggio non valido.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (!messageIdToRoles[messageIdInt] || !messageIdToRoles[messageIdInt][emoji]) {
        await interaction.reply({ content: '❌ Reaction role non trovato per questo messaggio/emoji.', flags: MessageFlags.Ephemeral });
        return;
    }

    delete messageIdToRoles[messageIdInt][emoji];
    if (!Object.keys(messageIdToRoles[messageIdInt]).length) {
        delete messageIdToRoles[messageIdInt];
    }
    saveReactionRoles();

    try {
        const channel = interaction.channel;
        const message = await channel.messages.fetch(messageIdInt);
        const reaction = message.reactions.cache.find(item => item.emoji.toString() === emoji) ?? message.reactions.resolve(emoji);
        if (reaction) {
            await reaction.remove();
        }

        await interaction.reply({
            content: `✅ Reaction role rimosso: ${emoji} dal messaggio ${messageId} (reazione rimossa dal messaggio)`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        await interaction.reply({
            content: `✅ Reaction role rimosso: ${emoji} dal messaggio ${messageId}\n⚠️ Non sono riuscito a rimuovere la reazione in automatico: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleReactionRoleAdd(reaction, user) {
    if (user?.bot) {
        return;
    }

    if (reaction.partial) {
        await reaction.fetch().catch(() => null);
    }

    const guild = reaction.message?.guild;
    if (!guild) {
        return;
    }

    const emoji = reaction.emoji.toString();
    const roleId = messageIdToRoles[reaction.message.id]?.[emoji];
    if (!roleId) {
        return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    const role = guild.roles.cache.get(roleId);
    if (!member || !role) {
        return;
    }

    await member.roles.add(role).catch(error => {
        console.error(`Errore nell'assegnazione del ruolo ${role.id} a ${member.id}:`, error);
    });
}

async function handleReactionRoleRemove(reaction, user) {
    if (user?.bot) {
        return;
    }

    if (reaction.partial) {
        await reaction.fetch().catch(() => null);
    }

    const guild = reaction.message?.guild;
    if (!guild) {
        return;
    }

    const emoji = reaction.emoji.toString();
    const roleId = messageIdToRoles[reaction.message.id]?.[emoji];
    if (!roleId) {
        return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    const role = guild.roles.cache.get(roleId);
    if (!member || !role) {
        return;
    }

    await member.roles.remove(role).catch(error => {
        console.error(`Errore nella rimozione del ruolo ${role.id} da ${member.id}:`, error);
    });
}

module.exports = {
    setReactionRole,
    removeReactionRole,
    handleReactionRoleAdd,
    handleReactionRoleRemove,
    loadReactionRoles,
    saveReactionRoles
};
