const path = require('node:path');
const fs = require('node:fs/promises');
const { ticketDataFiles } = require('./constants');

const dataPaths = {
  ids: path.resolve(process.cwd(), ticketDataFiles.id_counter),
  tickets: path.resolve(process.cwd(), ticketDataFiles.tickets),
  persistent: path.resolve(process.cwd(), ticketDataFiles.persistentData),
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

async function saveTicket(ticketKey, ticketData) {
  const allTickets = await readJson(dataPaths.tickets, {});
  allTickets[ticketKey] = ticketData;
  await writeJson(dataPaths.tickets, allTickets);
  return allTickets[ticketKey];
}

async function getTicket(ticketKey) {
  const allTickets = await readJson(dataPaths.tickets, {});
  return allTickets[ticketKey] ?? null;
}

async function getTicketByChannel(channelId) {
  const allTickets = await readJson(dataPaths.tickets, {});
  return Object.values(allTickets).find(t => t.channel_id === channelId) ?? null;
}

async function getOpenTicketByUser(userId) {
  const allTickets = await readJson(dataPaths.tickets, {});
  return Object.values(allTickets).find(t => t.user_id === userId && !t.closed_at) ?? null;
}

async function updateTicket(ticketKey, patch) {
  const allTickets = await readJson(dataPaths.tickets, {});
  if (!allTickets[ticketKey]) return null;
  allTickets[ticketKey] = { ...allTickets[ticketKey], ...patch };
  await writeJson(dataPaths.tickets, allTickets);
  return allTickets[ticketKey];
}

module.exports = {
  nextTicketId,
  saveTicket,
  getTicket,
  getTicketByChannel,
  getOpenTicketByUser,
  updateTicket
};