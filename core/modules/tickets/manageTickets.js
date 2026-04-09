const { tickets, ticketOptions, ticketDataFiles, staffRoleId, ticketActions } = require('./constants')
const fs = require('node:fs/promises')
const path = require('node:path')
const { ChannelType, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle, MessageFlags, PermissionsBitField, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js')
const { nextTicketId, saveTicket, saveLegacyTicket, getOpenTicketByUser, updateTicket, getTicketEntryByChannel } = require("./storage")
const { buildResponseEmbed } = require('../../src/lib/responseEmbed')

function userIsStaff(interaction) {
    if (!staffRoleId) return false;
    return interaction.member?.roles?.cache?.has(staffRoleId) ?? false;
}

async function replyStaffOnly(interaction) {
    await interaction.reply({
        content: 'Solo lo staff puo usare questa azione.',
        flags: MessageFlags.Ephemeral
    });
}

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

async function finalizeTicketClose(interaction, entry, ticketChannel, reason) {
    const parentCategoryId = ticketChannel?.parentId;

    if (!entry) {
        await interaction.reply({
            content: 'Impossibile trovare il ticket associato a questo canale.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (entry.ticket.closed_at) {
        await interaction.reply({
            content: `Questo ticket e gia stato chiuso da <@${entry.ticket.closed_by_id}>.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const closedAt = new Date().toLocaleString('it-IT', { hour12: false });
    await updateTicket(entry.key, {
        reason,
        closed_by_id: interaction.user.id,
        closed_by_username: interaction.user.username,
        closed_at: closedAt
    });

    const transcript = await buildTicketTranscript(ticketChannel).catch(() => null)
    await sendTicketTranscriptToLogs(interaction.guild, entry, transcript, interaction.user, closedAt, reason, entry.ticket.created_at).catch(() => null)

    const closeMessage = transcript
        ? `Ticket chiuso con successo. Transcript salvato in file: ${transcript.fileName}. Il canale verra eliminato tra pochi secondi.`
        : 'Ticket chiuso con successo. Non sono riuscito a generare il transcript, ma il canale verra eliminato tra pochi secondi.';

    const closePayload = {
        embeds: [buildResponseEmbed({
            title: 'Ticket Close',
            description: closeMessage
        })]
    };

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(closePayload).catch(() => null);
    } else {
        await interaction.reply({
            ...closePayload,
            flags: MessageFlags.Ephemeral
        }).catch(() => null);
    }

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


async function ticketCreate(interaction) {
    const guild = interaction.guild;
    const creatorId = interaction.user.id;
    const everyoneId = guild.roles.everyone.id;
    const userChoice = interaction.values[0];
    const selectedOption = ticketOptions.find(opt => opt.value === userChoice);

    if (!selectedOption) {
        await interaction.reply({
            embeds: [buildResponseEmbed({
                title: 'Ticket',
                description: 'Opzione non valida.'
            })],
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferUpdate();

    const ticketCategory = selectedOption.ticketCategory;
    const creatorUsername = interaction.user.username;
    const ticketChannelName = `ticket-${creatorUsername}`;
    // Permissions for the ticket (everyone denied, creator and staff allowed)
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

    // Check if user already has an open ticket
    const existingTicket = await getOpenTicketByUser(creatorId);
    if (existingTicket) {
        const existingChannel = await guild.channels.fetch(existingTicket.channel_id).catch(() => null);
        if (existingChannel) {
            await interaction.followUp({
                content: `You already have an open ticket in ${existingChannel}`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }

    // Get or create the category
    let categoryChannel = await getCategoryByName(guild, ticketCategory);
    if (!categoryChannel) {
        categoryChannel = await guild.channels.create({
            name: ticketCategory,
            type: ChannelType.GuildCategory,
            permissionOverwrites: ticketPermissions
        });
    }

    // Create the ticket channel
    const ticketChannel = await guild.channels.create({
        name: ticketChannelName,
        type: ChannelType.GuildText,
        parent: categoryChannel.id,
        permissionOverwrites: ticketPermissions
    });

    // Create and send the welcome embed
    const ticketEmbed = new EmbedBuilder()
        .setColor(0xff7900)
        .setTitle(`:ticket: Ticket - ${ticketCategory}`)
        .setDescription(`**${interaction.user} has opened a ticket for ${ticketCategory}**\nExplain your issue/request clearly and in detail. We will respond as soon as possible.`)
        .setFooter({
            text: "LegoChris Ticket System",
            iconURL: interaction.guild?.iconURL({ dynamic: true, size: 1024 })
        })
        .setThumbnail(interaction.guild?.iconURL({ dynamic: true, size: 1024 }));

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

    // Save ticket data
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

    await interaction.message.edit({ components: [buildTicketSelectRow(ticketOptions)] }).catch(() => null);

    // Reply to the user
    await interaction.followUp({
        content: `Ticket successfully opened in ${ticketChannel}`,
        flags: MessageFlags.Ephemeral
    });
}

async function ticketClose(interaction, ticketChannel = null, reason = null) {
    if (!userIsStaff(interaction)) {
        await replyStaffOnly(interaction);
        return;
    }

    const targetChannelId = ticketChannel?.id || interaction.channelId;
    const closeReason = (reason || interaction.options?.getString?.('reason') || '').trim();

    if (closeReason) {
        const entry = await getTicketEntryByChannel(targetChannelId);
        const resolvedTicketChannel = ticketChannel || interaction.channel;
        await finalizeTicketClose(interaction, entry, resolvedTicketChannel, closeReason);
        return;
    }

    const modal = new ModalBuilder().setCustomId(`closeTicketModal:${targetChannelId}`).setTitle('Close Ticket')
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
    if (!userIsStaff(interaction)) {
        await replyStaffOnly(interaction);
        return;
    }

    const reason = interaction.fields.getTextInputValue('reasonInput')?.trim();
    const modalTargetChannelId = interaction.customId.split(':')[1] || interaction.channelId;
    const ticketChannel = await interaction.guild.channels.fetch(modalTargetChannelId).catch(() => null);
    const entry = await getTicketEntryByChannel(modalTargetChannelId);
    await finalizeTicketClose(interaction, entry, ticketChannel, reason);
}

async function ticketClaim(interaction, ticketChannel = null){
    if (!userIsStaff(interaction)) {
        await replyStaffOnly(interaction);
        return;
    }

    const isButtonInteraction = interaction.isButton?.() ?? false;

    if (isButtonInteraction) {
        await interaction.deferUpdate().catch(() => null);
    }

    const targetChannelId = ticketChannel?.id || interaction.channelId;
    const entry = await getTicketEntryByChannel(targetChannelId);
    if (!entry) {
        const payload = {
            embeds: [buildResponseEmbed({
                title: 'Ticket',
                description: 'Unable to find the ticket associated with this channel.'
            })],
            flags: MessageFlags.Ephemeral
        };

        if (isButtonInteraction) {
            await interaction.followUp(payload).catch(() => null);
        } else {
            await interaction.reply(payload).catch(() => null);
        }
        return;
    }

    if (entry.ticket.claimed_by_id) {
        const payload = {
            embeds: [buildResponseEmbed({
                title: 'Ticket',
                description: `This ticket has already been claimed by <@${entry.ticket.claimed_by_id}>.`
            })],
            flags: MessageFlags.Ephemeral
        };

        if (isButtonInteraction) {
            await interaction.followUp(payload).catch(() => null);
        } else {
            await interaction.reply(payload).catch(() => null);
        }
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

    const channelToUpdate = ticketChannel || interaction.channel;
    await channelToUpdate.permissionOverwrites.set(overwrites);

    const remainingActions = ticketActions.filter(action => action.value !== 'ticket:claim');
    const updatedRow = new ActionRowBuilder().addComponents(
        remainingActions.map(action =>
            new ButtonBuilder()
                .setCustomId(action.value)
                .setLabel(action.label)
                .setStyle(action.style)
        )
    );

    // Edit the button message if available (button interaction)
    if (interaction.message) {
        await interaction.message.edit({ components: [updatedRow] }).catch(() => null);
    } else {
        // If it's a slash command, search for the message with the claim button in the channel
        try {
            const messages = await channelToUpdate.messages.fetch({ limit: 10 });
            const messageWithClaim = messages.find(msg => 
                msg.components.length > 0 && 
                msg.components[0].components.some(btn => btn.customId === 'ticket:claim')
            );
            
            if (messageWithClaim) {
                await messageWithClaim.edit({ components: [updatedRow] }).catch(() => null);
            }
        } catch (err) {
            // If we can't find the message, continue anyway
        }
    }

    // Invia il messaggio di conferma nel canale ticket
    await channelToUpdate.send({
        embeds: [buildResponseEmbed({
            title: 'Ticket Claim',
            description: `Ticket claimato da ${interaction.user}`
        })]
    });

    const successPayload = {
        embeds: [buildResponseEmbed({
            title: 'Ticket Claim',
            description: 'Ticket claimato con successo.'
        })],
        flags: MessageFlags.Ephemeral
    };

    if (isButtonInteraction) {
        await interaction.followUp(successPayload).catch(() => null);
    } else {
        await interaction.reply(successPayload).catch(() => null);
    }
}

async function importLegacyTicketChannel(interaction, targetChannel) {
    const existingEntry = await getTicketEntryByChannel(targetChannel.id);
    let wasRegistered = false;

    if (!existingEntry) {
        const memberOverwrites = [...targetChannel.permissionOverwrites.cache.values()]
            .filter(overwrite => overwrite.type === 1)
            .map(overwrite => overwrite.id);

        let authorMember = null;
        for (const memberId of memberOverwrites) {
            if (memberId === interaction.client.user.id) continue;
            const member = await interaction.guild.members.fetch(memberId).catch(() => null);
            if (!member || member.user.bot) continue;
            authorMember = member;
            break;
        }

        const ticketId = await nextTicketId();
        const authorId = authorMember?.id || interaction.user.id;
        const authorUsername = authorMember?.user?.username || interaction.user.username;
        const categoryName = targetChannel.parent?.name || 'Legacy Ticket';
        const ticketKey = `legacy-ticket-${authorId}-${ticketId}`;

        await saveLegacyTicket(ticketKey, {
            id: ticketId,
            author_user_id: authorId,
            author_username: authorUsername,
            category: categoryName,
            channel_id: targetChannel.id,
            claimed_by_id: null,
            claimed_by_username: null,
            closed_by_id: null,
            closed_by_username: null,
            created_at: new Date().toLocaleString('it-IT', { hour12: false }),
            closed_at: null,
            reason: null
        });

        wasRegistered = true;
    }

    const actions = ticketActions.map(action =>
        new ButtonBuilder()
            .setCustomId(action.value)
            .setLabel(action.label)
            .setStyle(action.style)
    );
    const row = new ActionRowBuilder().addComponents(actions);

    const managementEmbed = new EmbedBuilder()
        .setColor(0xff7900)
        .setTitle(':ticket: Ticket - Gestione')
        .setDescription('Questo ticket e stato importato dalla versione precedente. Usa i pulsanti qui sotto per gestirlo (claim/chiudi).')
        .setFooter({
            text: 'LegoChris Ticket System',
            iconURL: interaction.guild?.iconURL({ dynamic: true, size: 1024 })
        })
        .setThumbnail(interaction.guild?.iconURL({ dynamic: true, size: 1024 }) ?? null);

    await targetChannel.send({
        embeds: [managementEmbed],
        components: [row]
    });

    return { wasRegistered };
}

async function ticketOldAdd(interaction, ticketChannel = null) {
    if (!userIsStaff(interaction)) {
        await replyStaffOnly(interaction);
        return;
    }

    const targetChannel = ticketChannel || interaction.channel;
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        await interaction.reply({
            embeds: [buildResponseEmbed({
                title: 'Ticket Legacy Import',
                description: 'Specifica un canale testuale valido da importare.'
            })],
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const result = await importLegacyTicketChannel(interaction, targetChannel);

    await interaction.reply({
        embeds: [buildResponseEmbed({
            title: 'Ticket Legacy Import',
            description: result.wasRegistered
                ? `Ticket legacy registrato e pannello gestione inviato in ${targetChannel}.`
                : `Il canale era gia registrato. Ho comunque inviato un nuovo pannello gestione in ${targetChannel}.`
        })]
    });
}

async function ticketOldAddAll(interaction, targetCategory = null) {
    if (!userIsStaff(interaction)) {
        await replyStaffOnly(interaction);
        return;
    }

    await interaction.deferReply().catch(() => null);

    const channels = interaction.guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildText)
        .filter(channel => !targetCategory || channel.parentId === targetCategory.id)
        .filter(channel => channel.name.toLowerCase().startsWith('ticket-'));

    if (channels.size === 0) {
        await interaction.editReply({
            embeds: [buildResponseEmbed({
                title: 'Ticket Legacy Import',
                description: targetCategory
                    ? `Nessun canale ticket trovato nella categoria ${targetCategory}.`
                    : 'Nessun canale ticket legacy trovato da importare.'
            })]
        }).catch(() => null);
        return;
    }

    let imported = 0;
    let alreadyRegistered = 0;
    let failed = 0;

    for (const channel of channels.values()) {
        try {
            const result = await importLegacyTicketChannel(interaction, channel);
            if (result.wasRegistered) {
                imported += 1;
            } else {
                alreadyRegistered += 1;
            }
        } catch {
            failed += 1;
        }
    }

    await interaction.editReply({
        embeds: [buildResponseEmbed({
            title: 'Ticket Legacy Import',
            description: 'Import legacy completato.',
            fields: [
                { name: 'Canali trovati', value: String(channels.size), inline: true },
                { name: 'Nuovi registrati', value: String(imported), inline: true },
                { name: 'Gia registrati', value: String(alreadyRegistered), inline: true },
                { name: 'Falliti', value: String(failed), inline: true }
            ]
        })]
    }).catch(() => null);
}

function buildTicketSelectRow(options) {
    const menuOptions = options.map(option =>
        new StringSelectMenuOptionBuilder()
            .setLabel(option.label)
            .setDescription(option.description)
            .setValue(option.value)
    );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket:select')
        .setPlaceholder('Seleziona il tipo di ticket')
        .addOptions(menuOptions);

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getTicketChannels(guild) {
    return guild.channels.cache
        .filter(channel => 
            channel.name.startsWith('ticket-') && 
            !channel.isDMBased()
        )
        .map(channel => ({
            name: channel.name,
            value: channel.id
        }));
}

module.exports = {
    ticketCreate,
    ticketClose,
    handleCloseTicketModal,
    ticketClaim,
    ticketOldAdd,
    ticketOldAddAll,
    buildTicketSelectRow,
    getTicketChannels
};