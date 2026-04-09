const path = require('node:path');
const fs = require('node:fs/promises');
const { ticketDataFiles } = require('./constants');

const dataPaths = {
  ids: path.resolve(process.cwd(), ticketDataFiles.id_counter),
  tickets: path.resolve(process.cwd(), ticketDataFiles.tickets),
  legacy: path.resolve(process.cwd(), ticketDataFiles.legacy_tickets || './data/tickets/legacy_tickets.json'),
};

async function readJson(filePath, fallback = {}) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function nextTicketId() {
  const ids = await readJson(dataPaths.ids, { ticket_id: 0 });
  ids.ticket_id += 1;
  await writeJson(dataPaths.ids, ids);
  return ids.ticket_id;
}

async function currentTicketId(){
    const id = await readJson(dataPaths.ids, { ticket_id: 0 });
    return id;
}

async function saveTicket(ticketKey, ticketData) {
  const allTickets = await readJson(dataPaths.tickets, {});
  allTickets[ticketKey] = ticketData;
  await writeJson(dataPaths.tickets, allTickets);
  return allTickets[ticketKey];
}

async function saveLegacyTicket(ticketKey, ticketData) {
  const allTickets = await readJson(dataPaths.legacy, {});
  allTickets[ticketKey] = ticketData;
  await writeJson(dataPaths.legacy, allTickets);
  return allTickets[ticketKey];
}

async function getTicket(ticketKey) {
  const allTickets = await readJson(dataPaths.tickets, {});
  if (allTickets[ticketKey]) return allTickets[ticketKey];

  const legacyTickets = await readJson(dataPaths.legacy, {});
  return legacyTickets[ticketKey] ?? null;
}

async function getTicketByChannel(channelId) {
  const allTickets = await readJson(dataPaths.tickets, {});
  const found = Object.values(allTickets).find(t => t.channel_id === channelId);
  if (found) return found;

  const legacyTickets = await readJson(dataPaths.legacy, {});
  return Object.values(legacyTickets).find(t => t.channel_id === channelId) ?? null;
}

async function getTicketEntryByChannel(channelId) {
  const allTickets = await readJson(dataPaths.tickets, {});
  const entry = Object.entries(allTickets).find(([, t]) => t.channel_id === channelId);
  if (entry) {
    const [key, ticket] = entry;
    return { key, ticket, source: 'tickets' };
  }

  const legacyTickets = await readJson(dataPaths.legacy, {});
  const legacyEntry = Object.entries(legacyTickets).find(([, t]) => t.channel_id === channelId);
  if (!legacyEntry) return null;
  const [key, ticket] = legacyEntry;
  return { key, ticket, source: 'legacy' };
}

async function getOpenTicketByUser(userId) {
  const allTickets = await readJson(dataPaths.tickets, {});
  return Object.values(allTickets).find(t => t.user_id === userId && !t.closed_at) ?? null;
}

async function updateTicket(ticketKey, patch) {
  const allTickets = await readJson(dataPaths.tickets, {});
  if (allTickets[ticketKey]) {
    allTickets[ticketKey] = { ...allTickets[ticketKey], ...patch };
    await writeJson(dataPaths.tickets, allTickets);
    return allTickets[ticketKey];
  }

  const legacyTickets = await readJson(dataPaths.legacy, {});
  if (!legacyTickets[ticketKey]) return null;
  legacyTickets[ticketKey] = { ...legacyTickets[ticketKey], ...patch };
  await writeJson(dataPaths.legacy, legacyTickets);
  return legacyTickets[ticketKey];
}

module.exports = {
  nextTicketId,
  saveTicket,
  saveLegacyTicket,
  getTicket,
  getTicketByChannel,
  getTicketEntryByChannel,
  getOpenTicketByUser,
  updateTicket,
  currentTicketId
};