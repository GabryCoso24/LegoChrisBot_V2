const { tickets, ticketOptions, ticketDataFiles, staffRoleId, ticketActions } = require('./constants')
const fs = require('node:fs/promises')
const path = require('node:path')
const { ChannelType, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle, MessageFlags, PermissionsBitField, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder } = require('discord.js')
const { nextTicketId, saveTicket, getOpenTicketByUser, updateTicket, getTicketEntryByChannel } = require("./storage")
const { buildTicketSelectRow } = require('../../src/commands/utilities/tickets')

async function buildTicketTranscript(channel) {
    const transcriptDir = path.resolve(process.cwd(), 'data/tickets/transcripts')
    await fs.mkdir(transcriptDir, { recursive: true })

    const fetchedMessages = []
    let before

    while (true) {
        const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null)
        if (!batch || batch.size === 0) break

        fetchedMessages.push(...batch.values())
        before = batch.last().id

        if (batch.size < 100) break
    }

    fetchedMessages.sort((left, right) => left.createdTimestamp - right.createdTimestamp)

    const lines = [
        `# Transcript del canale #${channel.name}`,
        '',
        `- **ID Canale:** ${channel.id}`,
        `- **Creato il:** ${new Date().toLocaleString('it-IT', { hour12: false })}`,
        ''
    ]

    for (const message of fetchedMessages) {
        const timestamp = new Date(message.createdTimestamp).toLocaleString('it-IT', { hour12: false })
        const author = `${message.author.tag} (${message.author.id})`
        const content = message.content?.trim() || '[Nessun testo]'
        const attachments = [...message.attachments.values()].map(file => file.url)

        lines.push(`## ${author}`)
        lines.push(`*${timestamp}*`)
        lines.push('')
        lines.push(content)

        if (attachments.length > 0) {
            lines.push('')
            lines.push(`**Allegati:** ${attachments.join(' | ')}`)
        }

        if (message.embeds.length > 0) {
            lines.push(`**Embed:** ${message.embeds.length}`)
        }

        lines.push('')
    }

    const fileName = `transcript-${channel.id}.md`
    const filePath = path.join(transcriptDir, fileName)

    await fs.writeFile(filePath, lines.join('\n'), 'utf8')

    return { filePath, fileName }
}

async function getTicketLogsChannel(guild) {
    await guild.channels.fetch()

    return guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.name.toLowerCase() === tickets.logsChannel.toLowerCase()
    ) ?? null
}

async function sendTicketTranscriptToLogs(guild, entry, transcript, closedBy, closedAt, reason, openedAt) {
    const logsChannel = await getTicketLogsChannel(guild)
    if (!logsChannel || !transcript) {
        return false
    }

    const attachment = new AttachmentBuilder(transcript.filePath, { name: transcript.fileName })
    const logEmbed = new EmbedBuilder()
        .setColor(0xff7900)
        .setTitle(`:ticket: Ticket chiuso - ID: ${entry.ticket.id}`)
        .addFields(
            { name: 'Aperto da', value: `<@${entry.ticket.author_user_id}>`, inline: true },
            { name: 'Claimato da', value: entry.ticket.claimed_by_id ? `<@${entry.ticket.claimed_by_id}>` : 'Non claimato', inline: true },
            { name: 'Chiuso da', value: `<@${closedBy.id}>`, inline: true },
            { name: 'Categoria', value: entry.ticket.category ?? 'N/D', inline: true },
            { name: 'Aperto il', value: openedAt ?? 'N/D', inline: true},
            { name: 'Chiuso il', value: closedAt ?? 'N/D', inline: true },
            { name: 'Motivo', value: reason || 'Nessun motivo fornito', inline: false }
        )
        .setFooter({
            text: "LegoChris Ticket System",
            iconURL: guild?.iconURL({ dynamic: true, size: 1024 })
        })
        .setThumbnail(guild?.iconURL({ dynamic: true, size: 1024 }))

    await logsChannel.send({ embeds: [logEmbed] });
    await logsChannel.send({ files: [attachment] });

    return true
}


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
        .setTitle(`:ticket: Ticket - ${ticketCategory}`)
        .setDescription(`**${interaction.user} ha aperto un ticket per ${ticketCategory}**\nEsponi il tuo problema/richiesta in modo chiaro e dettagliato. Risponderemo al più presto possibile.`)
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
        author_user_id: creatorId,
        author_username: creatorUsername,
        category: ticketCategory,
        channel_id: ticketChannel.id,
        claimed_by_id: null,
        claimed_by_username: null,
        closed_by_id: null,
        closed_by_username: null,
        created_at: new Date().toLocaleString('it-IT', { hour12: false }),
        closed_at: null,
        reason: null,
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
    const ticketChannel = interaction.channel;
    const parentCategoryId = ticketChannel?.parentId;

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
        closed_by_id: interaction.user.id,
        closed_by_username: interaction.user.username,
        closed_at: closedAt
    });

    const transcript = await buildTicketTranscript(interaction.channel).catch(() => null)
    await sendTicketTranscriptToLogs(interaction.guild, entry, transcript, interaction.user, closedAt, reason, entry.ticket.created_at).catch(() => null)

    await interaction.reply({
        content: transcript
            ? `Ticket chiuso con successo. Transcript salvato in file: ${transcript.fileName}. Il canale verra eliminato tra pochi secondi.`
            : 'Ticket chiuso con successo. Non sono riuscito a generare il transcript, ma il canale verra eliminato tra pochi secondi.',
        flags: MessageFlags.Ephemeral
    });

    setTimeout(() => {
        ticketChannel?.delete('Ticket chiuso').catch(() => null);

        if (!parentCategoryId) {
            return;
        }

        interaction.guild.channels.fetch().then(() => {
            const hasOtherTicketChannels = interaction.guild.channels.cache.some(channel =>
                channel.parentId === parentCategoryId &&
                channel.id !== ticketChannel?.id &&
                channel.type === ChannelType.GuildText
            );

            if (!hasOtherTicketChannels) {
                const categoryChannel = interaction.guild.channels.cache.get(parentCategoryId);
                if (categoryChannel?.type === ChannelType.GuildCategory) {
                    return categoryChannel.delete('Categoria ticket vuota').catch(() => null);
                }
            }

            return null;
        }).catch(() => null);
    }, 1500);
}

async function ticketClaim(interaction){
    const entry = await getTicketEntryByChannel(interaction.channelId);
    if (!entry) {
        await interaction.reply({
            content: 'Impossibile trovare il ticket associato a questo canale.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const ticketAuthorId = entry.ticket.author_user_id;

    await updateTicket(entry.key, {
        claimed_by_id: interaction.user.id,
        claimed_by_username: interaction.user.username
    });

    const everyoneId = interaction.guild.roles.everyone.id;

    const overwrites = [
    {
        id: everyoneId,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    },
    {
		id: interaction.user.id,
		allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	}
    ];

    if (staffRoleId) {
        overwrites.push({
		id: staffRoleId,
		deny: [PermissionsBitField.Flags.SendMessages],
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
	});
    }

    if (ticketAuthorId) {
        overwrites.push({
		id: ticketAuthorId,
		allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	});
    }

    await interaction.channel.permissionOverwrites.set(overwrites);

    const remainingActions = ticketActions.filter(action => action.value !== 'ticket:claim');
    const updatedRow = new ActionRowBuilder().addComponents(
        remainingActions.map(action =>
            new ButtonBuilder()
                .setCustomId(action.value)
                .setLabel(action.label)
                .setStyle(action.style)
        )
    );

    await interaction.message.edit({ components: [updatedRow] }).catch(() => null);

    await interaction.reply(`Ticket Claimato da ${interaction.user}`);
}



module.exports = {
    ticketCreate,
    ticketClose,
    handleCloseTicketModal,
    ticketClaim
};