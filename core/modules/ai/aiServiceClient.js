const fs = require('node:fs');
const path = require('node:path');
const googleTTS = require('google-tts-api');
const config = require('../../src/config/config');

const dataDir = path.resolve(process.cwd(), 'data', 'ai');
const statePath = path.join(dataDir, 'state.json');
const MAX_CONTEXT_MESSAGES = 20;

const TARGET_ALIAS_REGEXES = [
    /^da ora chiama <@!?(\d+)>\s+(.+)$/i,
    /^ora chiama <@!?(\d+)>\s+(.+)$/i,
    /^chiama <@!?(\d+)>\s+(.+)$/i
];

const SELF_ALIAS_REGEXES = [
    /^da ora chiamami\s+(.+)$/i,
    /^ora chiamami\s+(.+)$/i,
    /^chiamami\s+(.+)$/i
];

function ensureState() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(statePath)) {
        const initial = {
            settings: {},
            memories: [],
            aliases: [],
            contexts: {}
        };
        fs.writeFileSync(statePath, JSON.stringify(initial, null, 2), 'utf8');
    }
}

function loadState() {
    ensureState();
    try {
        return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
        return {
            settings: {},
            memories: [],
            aliases: [],
            contexts: {}
        };
    }
}

function saveState(state) {
    ensureState();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function addContext(state, guildId, role, content) {
    const key = String(guildId);
    const history = state.contexts[key] || [];
    history.push({ role, content });
    state.contexts[key] = history.slice(-MAX_CONTEXT_MESSAGES);
}

function getContext(state, guildId) {
    return state.contexts[String(guildId)] || [];
}

function stripBotMentions(text, botId) {
    if (!botId) {
        return text.trim();
    }

    return text.replace(new RegExp(`<@!?${String(botId)}>`,'g'), '').trim();
}

function findAliasCommand(text) {
    for (const regex of TARGET_ALIAS_REGEXES) {
        const match = text.match(regex);
        if (match) {
            return { kind: 'target', groups: match.slice(1) };
        }
    }

    for (const regex of SELF_ALIAS_REGEXES) {
        const match = text.match(regex);
        if (match) {
            return { kind: 'self', groups: match.slice(1) };
        }
    }

    return null;
}

function buildPrompt(state, guildId, userId, username, text) {
    const memories = state.memories
        .filter(item => item.guild_id === String(guildId) && item.user_id === String(userId))
        .sort((a, b) => {
            if (b.importance !== a.importance) {
                return b.importance - a.importance;
            }
            return new Date(b.created_at) - new Date(a.created_at);
        })
        .slice(0, 5);

    const aliases = state.aliases
        .filter(item => item.guild_id === String(guildId))
        .map(item => `<@${item.target_user_id}> si chiama '${item.alias}'`)
        .join('\n') || 'Nessun soprannome.';

    const memoriesText = memories.length
        ? memories.map(item => `${item.key}: ${item.value}`).join('\n')
        : 'Nessuna.';

    const contextText = getContext(state, guildId)
        .map(item => `${item.role.toUpperCase()}: ${item.content}`)
        .join('\n') || 'Nessun contesto precedente.';

    return [
        `Sei un assistente Discord. Il tuo nome è ${config.botName || 'LegoChrisBot'}.`,
        'Rispondi SEMPRE in ITALIANO.',
        `L'utente che ti sta parlando è <@${userId}>.`,
        `Quando ti riferisci a lui, usa <@${userId}>.`,
        "Per altri utenti usa <@ID_UTENTE>. Non scrivere mai 'ID' letteralmente.",
        '',
        `Memorie utente:\n${memoriesText}`,
        '',
        `Soprannomi:\n${aliases}`,
        '',
        `Contesto recente:\n${contextText}`,
        '',
        `Utente ${username}: ${text}`
    ].join('\n');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildGeminiModelList() {
    const configured = String(config.geminiModel || 'gemini-1.5-flash').trim();
    const fallback = String(config.geminiFallbackModels || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    return [...new Set([configured, ...fallback])];
}

function isRetriableGeminiError(status, message) {
    const text = String(message || '').toLowerCase();
    return status === 429 || status === 503 || text.includes('high demand') || text.includes('try again later');
}

async function callGemini(prompt) {
    if (!config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY non configurata');
    }

    const models = buildGeminiModelList();
    const maxAttempts = Math.max(1, Number(config.geminiRetries || 3));
    const errors = [];
    const retriableErrors = [];

    for (const modelName of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500
                    }
                })
            });

            const data = await response.json().catch(() => ({}));
            const errMsg = data?.error?.message || 'Errore Gemini';

            if (response.ok) {
                const text = data?.candidates?.[0]?.content?.parts
                    ?.map(part => part?.text || '')
                    .join('')
                    .trim();

                return text || 'Non sono riuscito a generare una risposta.';
            }

            const retriable = isRetriableGeminiError(response.status, errMsg);
            errors.push(`${modelName}#${attempt} -> ${response.status}: ${errMsg}`);
            if (retriable) {
                retriableErrors.push(`${modelName}#${attempt} -> ${response.status}: ${errMsg}`);
            }

            if (!retriable || attempt >= maxAttempts) {
                break;
            }

            await sleep(400 * attempt);
        }
    }

    if (retriableErrors.length > 0) {
        throw new Error(`Servizio AI temporaneamente occupato. Riprova tra poco. (${retriableErrors[retriableErrors.length - 1]})`);
    }

    const safeError = errors.find(item => !item.includes('404')) || errors[errors.length - 1] || 'nessun dettaglio';
    throw new Error(`Servizio AI non disponibile. (${safeError})`);
}

function splitTextForTts(text, maxLength = 180) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return [normalized];
    }

    const words = normalized.split(' ');
    const chunks = [];
    let current = '';

    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxLength) {
            current = next;
        } else {
            if (current) {
                chunks.push(current);
            }
            current = word;
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks.filter(Boolean);
}

function extractMemoriesFallback(text) {
    const matches = text.match(/(?:mi chiamo|sono|mi piace|preferisco)\s+([^\.\!\?]{2,80})/gi) || [];
    return matches.slice(0, 3).map((match, index) => ({
        key: `memory_${Date.now()}_${index}`,
        value: match.trim(),
        importance: 3
    }));
}

async function getSettings(guildId) {
    const state = loadState();
    return state.settings[String(guildId)] || null;
}

async function setSettings(guildId, aiChannelId, allowedRoleId) {
    const state = loadState();
    state.settings[String(guildId)] = {
        ai_channel_id: aiChannelId || '0',
        allowed_role_id: allowedRoleId || null
    };
    saveState(state);
    return { ok: true, settings: state.settings[String(guildId)] };
}

async function getMemories(guildId, userId, limit = 5) {
    const state = loadState();
    return state.memories
        .filter(item => item.guild_id === String(guildId) && item.user_id === String(userId))
        .sort((a, b) => {
            if (b.importance !== a.importance) {
                return b.importance - a.importance;
            }
            return new Date(b.created_at) - new Date(a.created_at);
        })
        .slice(0, limit)
        .map(item => ({
            key: item.key,
            value: item.value,
            importance: item.importance
        }));
}

async function forgetMemories(guildId, userId) {
    const state = loadState();
    state.memories = state.memories.filter(item => !(item.guild_id === String(guildId) && item.user_id === String(userId)));
    saveState(state);
    return { ok: true };
}

async function getAliases(guildId) {
    const state = loadState();
    return state.aliases
        .filter(item => item.guild_id === String(guildId))
        .reduce((acc, item) => {
            acc[item.target_user_id] = item.alias;
            return acc;
        }, {});
}

async function chat(guildId, userId, username, message, botId) {
    const state = loadState();
    const cleaned = stripBotMentions(message, botId);
    const aliasCmd = findAliasCommand(cleaned);

    if (aliasCmd?.kind === 'target') {
        const [targetUserId, alias] = aliasCmd.groups;
        state.aliases = state.aliases.filter(item => !(item.guild_id === String(guildId) && item.target_user_id === String(targetUserId)));
        state.aliases.push({
            owner_user_id: String(userId),
            target_user_id: String(targetUserId),
            guild_id: String(guildId),
            alias: String(alias).trim(),
            created_at: new Date().toISOString()
        });
        const reply = `👌 Ok. Da ora <@${targetUserId}> è **${String(alias).trim()}**.`;
        addContext(state, guildId, 'user', cleaned);
        addContext(state, guildId, 'assistant', reply);
        saveState(state);
        return { kind: 'alias_saved', reply };
    }

    if (aliasCmd?.kind === 'self') {
        const [alias] = aliasCmd.groups;
        state.aliases = state.aliases.filter(item => !(item.guild_id === String(guildId) && item.target_user_id === String(userId)));
        state.aliases.push({
            owner_user_id: String(userId),
            target_user_id: String(userId),
            guild_id: String(guildId),
            alias: String(alias).trim(),
            created_at: new Date().toISOString()
        });
        const reply = `👌 Ok. Da ora ti chiamerò **${String(alias).trim()}**.`;
        addContext(state, guildId, 'user', cleaned);
        addContext(state, guildId, 'assistant', reply);
        saveState(state);
        return { kind: 'self_alias_saved', reply };
    }

    addContext(state, guildId, 'user', cleaned);
    const prompt = buildPrompt(state, guildId, userId, username, cleaned);
    const responseText = await callGemini(prompt);
    addContext(state, guildId, 'assistant', responseText);

    let memoriesAdded = 0;
    for (const memory of extractMemoriesFallback(cleaned)) {
        state.memories.push({
            user_id: String(userId),
            guild_id: String(guildId),
            key: memory.key,
            value: memory.value,
            importance: memory.importance,
            created_at: new Date().toISOString()
        });
        memoriesAdded += 1;
    }

    saveState(state);
    return {
        kind: 'response',
        reply: responseText,
        response: responseText,
        memories_added: memoriesAdded
    };
}

async function generateTts(text) {
    const cleanedText = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleanedText) {
        throw new Error('Text is empty after sanitization');
    }

    const chunks = splitTextForTts(cleanedText);
    const buffers = [];

    for (const chunk of chunks) {
        const audioUrl = googleTTS.getAudioUrl(chunk, {
            lang: config.ttsLang || 'it',
            slow: Boolean(config.ttsSlow),
            host: 'https://translate.google.com'
        });

        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`Google TTS non disponibile (${response.status})`);
        }

        buffers.push(Buffer.from(await response.arrayBuffer()));
    }

    const audioBuffer = Buffer.concat(buffers);
    if (!audioBuffer.length) {
        throw new Error('Google TTS ha restituito audio vuoto');
    }

    return {
        audio_base64: audioBuffer.toString('base64'),
        file_name: `tts-${Date.now()}.mp3`
    };
}

module.exports = {
    getSettings,
    setSettings,
    getMemories,
    forgetMemories,
    chat,
    getAliases,
    generateTts
};
