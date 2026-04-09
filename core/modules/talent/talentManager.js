const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_FILE = path.resolve(process.cwd(), 'data/talent/talent_data.json');
const EMPTY_STATE = { users: {} };

const ROLE_NAMES = {
    host: 'Presentatore',
    judge: 'Giudice',
    participant: 'Partecipante'
};

const ROLE_NAMES_WITH_ICON = {
    host: 'Presentatore 🎙️',
    judge: 'Giudice ⚖️',
    participant: 'Partecipante 🎤'
};

function getRoleLabel(role, isJudge = false, withIcon = false) {
    const base = withIcon ? ROLE_NAMES_WITH_ICON : ROLE_NAMES;
    const hostLabel = base.host || 'Presentatore';
    const judgeLabel = base.judge || 'Giudice';

    if (role === 'host' && isJudge) {
        return `${hostLabel} + ${judgeLabel}`;
    }

    return base[role] || role;
}

async function readJson(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
}

async function getState() {
    const state = await readJson(DATA_FILE, EMPTY_STATE);

    if (!state || typeof state !== 'object' || typeof state.users !== 'object' || state.users === null) {
        return { ...EMPTY_STATE };
    }

    return state;
}

async function saveState(state) {
    await writeJson(DATA_FILE, state);
}

async function registerUser(user, role, isAlsoJudge = false) {
    const state = await getState();
    const userId = String(user.id);
    const isJudge = role === 'judge' ? true : role === 'host' ? Boolean(isAlsoJudge) : false;

    if (state.users[userId]) {
        const current = state.users[userId];
        return {
            ok: false,
            reason: 'already_registered',
            currentRole: current.role,
            currentIsJudge: Boolean(current.isJudge),
            currentRoleLabel: getRoleLabel(current.role, Boolean(current.isJudge), false)
        };
    }

    state.users[userId] = {
        role,
        isJudge,
        points: 0,
        name: user.globalName || user.username
    };

    await saveState(state);

    return {
        ok: true,
        role,
        isJudge,
        roleName: getRoleLabel(role, isJudge, true)
    };
}

async function updateUserRole(user, role, isAlsoJudge = false) {
    const state = await getState();
    const userId = String(user.id);
    const current = state.users[userId];

    if (!current) {
        return {
            ok: false,
            reason: 'not_registered'
        };
    }

    const isJudge = role === 'judge' ? true : role === 'host' ? Boolean(isAlsoJudge) : false;

    current.role = role;
    current.isJudge = isJudge;
    if (!current.name) {
        current.name = user.globalName || user.username;
    }

    await saveState(state);

    return {
        ok: true,
        role,
        isJudge,
        roleName: getRoleLabel(role, isJudge, true)
    };
}

async function canAssignPoints(authorId, isAdmin = false) {
    if (isAdmin) {
        return true;
    }

    const state = await getState();
    const author = state.users[String(authorId)];
    if (!author) return false;

    if (author.role === 'judge') {
        return true;
    }

    if (author.role === 'host') {
        // Backward compatibility: older host entries without isJudge stay authorized.
        return author.isJudge === undefined ? true : Boolean(author.isJudge);
    }

    return false;
}

async function addPointsToParticipant(user, points) {
    const state = await getState();
    const targetId = String(user.id);
    const target = state.users[targetId];

    if (!target) {
        return { ok: false, reason: 'not_registered' };
    }

    if (target.role !== 'participant') {
        return {
            ok: false,
            reason: 'not_participant',
            currentRole: target.role,
            currentIsJudge: Boolean(target.isJudge),
            currentRoleLabel: getRoleLabel(target.role, Boolean(target.isJudge), false)
        };
    }

    target.points += points;
    await saveState(state);

    return {
        ok: true,
        points,
        total: target.points
    };
}

async function getLeaderboard() {
    const state = await getState();

    return Object.values(state.users)
        .filter(user => user.role === 'participant')
        .map(user => ({
            name: user.name,
            points: user.points
        }))
        .sort((a, b) => b.points - a.points);
}

async function getUsersGroupedByRole() {
    const state = await getState();
    const users = Object.values(state.users);

    const grouped = {
        host: [],
        judge: [],
        participant: []
    };

    for (const user of users) {
        if (!grouped[user.role]) continue;
        grouped[user.role].push(user);
    }

    return {
        grouped,
        total: users.length
    };
}

module.exports = {
    ROLE_NAMES,
    ROLE_NAMES_WITH_ICON,
    getRoleLabel,
    registerUser,
    updateUserRole,
    canAssignPoints,
    addPointsToParticipant,
    getLeaderboard,
    getUsersGroupedByRole
};
