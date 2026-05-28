const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

/**
 * LLM helper — uses OPENAI_KEY env var.
 * All functions accept an array of message objects and return structured JSON.
 */

function getModel() {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY environment variable is not set');
    return new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: 'gpt-4o-mini',
        temperature: 0.3,
    });
}

function buildMessageContext(messages) {
    if (!messages || messages.length === 0) return 'No messages today.';
    return messages.map(m => {
        const from = m.fromName || m.from || m.envelope?.from?.[0]?.name || m.envelope?.from?.[0]?.address || 'Unknown';
        const service = m._service || 'unknown';
        const body = m.bodyText || m.body || m.message || m.envelope?.subject || '';
        const time = m._savedAt ? new Date(m._savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
        return `[${service}] ${from} (${time}): ${body.slice(0, 500)}`;
    }).join('\n');
}

async function generateSummary(messages) {
    const model = getModel();
    const context = buildMessageContext(messages);
    const response = await model.invoke([
        new SystemMessage(
            'You are a personal assistant that summarizes daily messages. ' +
            'Provide a concise, friendly summary (2-4 sentences) of the most important things from today\'s messages. ' +
            'Focus on action items, key information, and anything time-sensitive. ' +
            'Address the user directly with "you". Do not use markdown formatting.'
        ),
        new HumanMessage(`Here are today's messages:\n\n${context}\n\nPlease provide a brief daily summary.`),
    ]);
    return response.content;
}

async function generateTodos(messages) {
    const model = getModel();
    const context = buildMessageContext(messages);
    const response = await model.invoke([
        new SystemMessage(
            'You are a personal assistant that extracts actionable to-do items from messages. ' +
            'Return ONLY a valid JSON array of objects with fields: "text" (the todo item, concise), "meta" (source info like "From Name - Service - today"). ' +
            'Extract up to 6 to-do items. If no actionable items exist, return an empty array []. ' +
            'Do NOT wrap in markdown code blocks. Return raw JSON only.'
        ),
        new HumanMessage(`Here are today's messages:\n\n${context}\n\nExtract actionable to-do items as a JSON array.`),
    ]);
    try {
        const content = response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        return JSON.parse(content);
    } catch {
        return [];
    }
}

async function generateWhatMatters(messages) {
    const model = getModel();
    const context = buildMessageContext(messages);
    const response = await model.invoke([
        new SystemMessage(
            'You are a personal assistant that identifies the top 3 most important things from today\'s messages. ' +
            'Return ONLY a valid JSON array of up to 3 objects with fields: ' +
            '"kind" (category label like "Tasks", "Schedule", "Heads up", "Urgent", "Follow-up"), ' +
            '"kindColor" ("insight" for tasks, "accent" for schedule, "email" for alerts/heads-up), ' +
            '"title" (a one-sentence summary of what matters, mentioning key details), ' +
            '"context" (source info like "WhatsApp - Name, Name" or "Email - Sender"). ' +
            'If no messages exist, return an empty array []. ' +
            'Do NOT wrap in markdown code blocks. Return raw JSON only.'
        ),
        new HumanMessage(`Here are today's messages:\n\n${context}\n\nIdentify the top 3 most important things as a JSON array.`),
    ]);
    try {
        const content = response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        return JSON.parse(content);
    } catch {
        return [];
    }
}

module.exports = { generateSummary, generateTodos, generateWhatMatters };
