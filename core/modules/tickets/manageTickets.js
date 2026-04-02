const { tickets, ticketOptions, ticketDataFiles, staffRoleId, ticketActions } = require('./constants')
const { ChannelType, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require('discord.js')
const { nextTicketId, saveTicket, getOpenTicketByUser, updateTicket, getTicketEntryByChannel } = require("./storage")
const { buildTicketSelectRow } = require('../../src/commands/utilities/tickets')


async function getCategoryByName(guild, name) {
  await guild.channels.fetch();
  const normalized = name.trim().toLowerCase();
  return guild.channels.cache.find(
    ch => ch.name.toLowerCase() === normalized && ch.type === ChannelType.GuildCategory
  ) ?? null;
}


async function ticketCreate(interaction) {
    const guild = interaction.guild;
    const creatorId = interaction.user.id;
    const everyoneId = guild.roles.everyone.id;
    const userChoice = interaction.values[0];
    const selectedOption = ticketOptions.find(opt => opt.value === userChoice);
    const ticketCategory = selectedOption.ticketCategory;
    const creatorUsername = interaction.user.username;
    const ticketChannelName = `ticket-${creatorUsername}`;
    // Permessi per il ticket (everyone negato, creator e staff permessi)
    const ticketPermissions = [
        {
            id: everyoneId,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: creatorId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
            id: staffRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
        }
    ];

    if (!selectedOption) {
        await interaction.reply({ content: 'Opzione non valida.', flags: MessageFlags.Ephemeral });
        return;
    }

    // Controlla se l'utente ha già un ticket aperto
    const existingTicket = await getOpenTicketByUser(creatorId);
    if (existingTicket) {
        const existingChannel = await guild.channels.fetch(existingTicket.channel_id).catch(() => null);
        if (existingChannel) {
            await interaction.reply({
                content: `Hai già un ticket aperto in ${existingChannel}`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }

    // Recupera o crea la categoria
    let categoryChannel = await getCategoryByName(guild, ticketCategory);
    if (!categoryChannel) {
        categoryChannel = await guild.channels.create({
            name: ticketCategory,
            type: ChannelType.GuildCategory,
            permissionOverwrites: ticketPermissions
        });
    }

    // Crea il canale ticket
    const ticketChannel = await guild.channels.create({
        name: ticketChannelName,
        type: ChannelType.GuildText,
        parent: categoryChannel.id,
        permissionOverwrites: ticketPermissions
    });

    // Crea e invia l'embed di benvenuto
    const ticketEmbed = new EmbedBuilder()
        .setColor(0xff7900)
        .setTitle(`:ticket: Ticket - ${selectedOption.label}`)
        .setDescription(`**${interaction.user} ha aperto un ticket per ${ticketCategory}**`)
        .setFooter({
            text: "LegoChris Ticket System",
            iconURL: interaction.guild?.iconURL({ dynamic: true, size: 1024 })
        })

    const actions = ticketActions.map(action =>
        new ButtonBuilder()
        .setCustomId(action.value)
        .setLabel(action.label)
        .setStyle(action.style)    
    );

    const row = new ActionRowBuilder().addComponents(actions);
    await ticketChannel.send({ 
        embeds: [ticketEmbed],
        components: [row]
    });

    // Salva i dati del ticket
    const ticketId = await nextTicketId();
    const ticketKey = `ticket-${creatorId}-${ticketId}`;
    const ticketRecord = {
        id: ticketId,
        user_id: creatorId,
        username: creatorUsername,
        category: ticketCategory,
        channel_id: ticketChannel.id,
        message_id: null,
        claimed_by: null,
        closed_by: null,
        created_at: new Date().toLocaleString('it-IT', { hour12: false }),
        closed_at: null,
        reason: null,
        button_data: {
            claim_button: false,
            close_with_reason_button: false
        }
    };

    await saveTicket(ticketKey, ticketRecord);

    await interaction.update({ components: [buildTicketSelectRow(ticketOptions)]});

    // Risponde all'utente
    await interaction.followUp({
        content: `Ticket aperto con successo in ${ticketChannel}`,
        flags: MessageFlags.Ephemeral
    });
}

async function ticketClose(interaction) {
    const modal = new ModalBuilder().setCustomId('closeTicketModal').setTitle('Chiudi Ticket')
        const reasonInput = new TextInputBuilder()
			.setCustomId('reasonInput')
			// Short means a single line of text.
			.setStyle(TextInputStyle.Short)
			// Placeholder text displayed inside the text input box
			.setPlaceholder('Specifica il motivo per cui vuoi chiudere il ticket.')
            .setRequired(true);
		const reasonLabel = new LabelBuilder()
			// The label is a large header that identifies the interactive component for the user.
			.setLabel("Motivo:")
			// Set text input as the component of the label
			.setTextInputComponent(reasonInput);
		// Add the label to the modal
		modal.addLabelComponents(reasonLabel);

    await interaction.showModal(modal)
}

async function handleCloseTicketModal(interaction) {
    const reason = interaction.fields.getTextInputValue('reasonInput')?.trim();
    const entry = await getTicketEntryByChannel(interaction.channelId);

    if (!entry) {
        await interaction.reply({
            content: 'Impossibile trovare il ticket associato a questo canale.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const closedAt = new Date().toLocaleString('it-IT', { hour12: false });
    await updateTicket(entry.key, {
        reason,
        closed_by: interaction.user.id,
        closed_at: closedAt
    });

    await interaction.reply({
        content: 'Ticket chiuso con successo. Il canale verra eliminato tra pochi secondi.',
        flags: MessageFlags.Ephemeral
    });

    setTimeout(() => {
        interaction.channel?.delete('Ticket chiuso').catch(() => null);
    }, 1500);
}

module.exports = {
    ticketCreate,
    ticketClose,
    handleCloseTicketModal
};