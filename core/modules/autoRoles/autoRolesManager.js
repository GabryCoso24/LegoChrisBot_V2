const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DATA_PATH = path.resolve(process.cwd(), 'data', 'autoRoles', 'autoroles.json');

const DEFAULT_CONFIG = {
    enabled: true,
    userRoleIds: [],
    botRoleIds: []
};

// ===== I/O helpers =====

function loadConfig() {
    try {
        if (!fs.existsSync(DATA_PATH)) return { ...DEFAULT_CONFIG, userRoleIds: [], botRoleIds: [] };
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        const parsed = JSON.parse(raw);

        // Migrazione da vecchia struttura roleIds -> userRoleIds
        const legacyRoleIds = Array.isArray(parsed.roleIds) ? parsed.roleIds : [];

        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            userRoleIds: Array.isArray(parsed.userRoleIds) ? parsed.userRoleIds : legacyRoleIds,
            botRoleIds: Array.isArray(parsed.botRoleIds) ? parsed.botRoleIds : []
        };
    } catch (err) {
        console.error('[AutoRolesManager] Errore nel caricamento della config:', err);
        return { ...DEFAULT_CONFIG, userRoleIds: [], botRoleIds: [] };
    }
}

async function saveConfig(config) {
    await fsp.mkdir(path.dirname(DATA_PATH), { recursive: true });
    // Rimuovi il vecchio campo legacy se ancora presente
    const { roleIds: _legacy, ...clean } = config;
    await fsp.writeFile(DATA_PATH, JSON.stringify(clean, null, 2), 'utf8');
}

// ===== Assign helper =====

async function assignRoles(member, roleIds, label) {
    const guild = member.guild;
    const me = guild.members.me ?? guild.members.cache.get(member.client.user.id);

    for (const roleId of roleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            console.warn(`[AutoRolesManager] Ruolo ${roleId} non trovato nel server.`);
            continue;
        }

        if (me && role.position >= me.roles.highest.position) {
            console.warn(`[AutoRolesManager] Non posso assegnare il ruolo ${role.name} a ${label} (posizione troppo alta).`);
            continue;
        }

        await member.roles.add(role, `Auto Role al join (${label})`).catch(err => {
            console.error(`[AutoRolesManager] Errore nell'assegnazione del ruolo ${roleId} a ${member.id}:`, err);
        });
    }
}

// ===== Main handler =====

async function handleMemberJoin(member) {
    const config = loadConfig();
    if (!config.enabled) return;

    if (member.user.bot) {
        if (config.botRoleIds.length > 0) {
            await assignRoles(member, config.botRoleIds, 'bot');
        }
    } else {
        if (config.userRoleIds.length > 0) {
            await assignRoles(member, config.userRoleIds, 'utente');
        }
    }
}

// ===== Config management functions (used by slash command) =====

function getConfig() {
    return loadConfig();
}

// tipo: 'utenti' | 'bot'
async function addRole(roleId, tipo) {
    const config = loadConfig();
    const list = tipo === 'bot' ? 'botRoleIds' : 'userRoleIds';
    if (!config[list].includes(roleId)) {
        config[list].push(roleId);
        await saveConfig(config);
        return true;
    }
    return false;
}

async function removeRole(roleId, tipo) {
    const config = loadConfig();
    const list = tipo === 'bot' ? 'botRoleIds' : 'userRoleIds';
    const index = config[list].indexOf(roleId);
    if (index !== -1) {
        config[list].splice(index, 1);
        await saveConfig(config);
        return true;
    }
    return false;
}

async function setEnabled(enabled) {
    const config = loadConfig();
    config.enabled = enabled;
    await saveConfig(config);
}

// tipo: 'utenti' | 'bot' | 'tutti'
async function clearRoles(tipo) {
    const config = loadConfig();
    if (tipo === 'bot') {
        config.botRoleIds = [];
    } else if (tipo === 'utenti') {
        config.userRoleIds = [];
    } else {
        config.userRoleIds = [];
        config.botRoleIds = [];
    }
    await saveConfig(config);
}

module.exports = {
    handleMemberJoin,
    getConfig,
    addRole,
    removeRole,
    setEnabled,
    clearRoles
};
