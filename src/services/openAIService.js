import { OpenAI } from 'openai';
import Joi from 'joi';
import { complexKeywords } from '../utils/utilityEnums.js';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set in environment variables');
}

let client = null;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Input validation schema
const taskSchema = Joi.object({
  title: Joi.string().trim().max(500).required(),
  description: Joi.string().trim().allow('').max(10000),
  helperText: Joi.string().trim().allow('').max(10000),
  strictMode: Joi.boolean().default(true)
});

function buildPrompt({ title, description, helperText }) {
  const fewShot = [
    {
      title: 'Simple Bugfix',
      description: 'Fix user profile picture not uploading',
      helper: '',
      label: 'true'
    },
    {
      title: 'Create Monthly Report',
      description: 'Generate sales report every month',
      helper: '',
      label: 'false'
    },
    {
      title: 'Design Brochure',
      description: 'Create a marketing brochure for the new product',
      helper: '',
      label: 'false'
    },
    {
      title: 'Update Email',
      description: 'Send email to team about meeting',
      helper: '',
      label: 'true'
    }
  ];

  // Format complex keywords for context
  const complexKeywordsList = complexKeywords.join(', ');

  return `You are a binary classifier that determines if a task costs 1 credit (simple) or 2 credits (complex).

You MUST respond with exactly one lowercase word: "true" or "false"
- "true" → task costs 1 credit (simple)
- "false" → task costs 2 credits (complex)
No punctuation, no explanation, no JSON, no extra text.

-----------------------------------
CREDIT RULES:
-----------------------------------
1️⃣ **SIMPLE TASKS (1 credit / "true")**
Return "true" if:
- The task can be completed quickly (≈ under 30 minutes) in a single day.
- It clearly says it’s *simple*, *short*, *quick*, *easy*, *straightforward*, or *minor*.
- It involves filling, reading, or writing a *small or single form*.
- It doesn’t mention creating, designing, editing, researching, analyzing, or preparing complex materials.

✅ Examples of "true" (1 credit):
- "Fill out a short feedback form."
- "Enter contact details in a spreadsheet."
- "Upload a profile picture."
- "Write a short 2-line email reply."
- "Sign and return a one-page document."

2️⃣ **COMPLEX TASKS (2 credits / "false")**
Return "false" if:
- The task involves **multiple steps**, **significant time**, or **technical or creative effort**.
- The task includes **complex keywords** (see list below) *unless* explicitly described as "simple", "quick", or "short".
- It mentions writing, editing, analyzing, creating, designing, researching, or formatting detailed materials.
- It involves generating, reviewing, or compiling multiple documents, reports, or spreadsheets.
- It includes analytical, or strategic work.

🧠 Complex Keywords:
${complexKeywordsList}

⚠️ Exception:
If the description explicitly says the task is *simple*, *short*, *quick*, *easy*, *minor*, or *takes little time*, treat it as **1 credit ("true")**, even if it contains a complex keyword like "form", "document", "report", etc.

-----------------------------------
EXAMPLES
-----------------------------------
Task: "A simple form to fill out."
→ true

Task: "Complete a long government tax form."
→ false

Task: "Write a detailed project proposal document."
→ false

Task: "Quickly check and approve a one-page letter."
→ true

Task: "Design a poster for the annual event."
→ false

Task: "Submit a small feedback form, takes 5 minutes."
→ true

-----------------------------------
Now classify the following task.
Title: {title}
Description: {description}
-----------------------------------
Answer only with "true" or "false".
`;
}

/**
 * Parse boolean from model text response
 * @param {string} text - Raw text from OpenAI
 * @returns {boolean|null} Parsed boolean or null if cannot parse
 */
function parseBooleanFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.trim().toLowerCase();
  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;
  const match = cleaned.match(/\b(true|false)\b/);
  if (match) return match[1] === 'true';
  return null;
}

/**
 * Assess if a task costs 1 credit (simple) or 2 credits (complex) using OpenAI
 * @param {Object} taskData - Task data to assess
 * @param {string} taskData.title - Task title (required)
 * @param {string} taskData.description - Task description (optional)
 * @param {string} taskData.helperText - Helper text (optional)
 * @param {boolean} taskData.strictMode - Strict mode flag (optional, default: true)
 * @returns {Promise<Object>} Assessment result - true for 1 credit, false for 2 credits
 */
export async function assessTaskCost(taskData) {
  const { error, value } = taskSchema.validate(taskData);
  if (error) {
    const err = new Error(error.message);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const { title, description, helperText, strictMode } = value;
  if (!client) {
    const err = new Error(
      'OpenAI client is not initialized. OPENAI_API_KEY is missing.'
    );
    err.status = 500;
    err.code = 'OPENAI_NOT_INITIALIZED';
    throw err;
  }

  const prompt = buildPrompt({ title, description, helperText });

  const maxRetries = parseInt(process.env.MAX_RETRIES || '2', 10);
  let attempt = 0;
  let finalParsed = null;
  let rawText = null;

  while (attempt <= maxRetries && finalParsed === null) {
    attempt += 1;
    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.0,
        max_tokens: 10
      });

      rawText =
        response.choices?.[0]?.message?.content?.trim() ||
        response.choices?.[0]?.message?.content ||
        null;
      if (!rawText) {
        rawText = JSON.stringify(response);
      }

      const parsed = parseBooleanFromText(rawText);
      if (parsed === null && attempt <= maxRetries) {
        continue;
      }
      console.log('parsed', parsed);
      finalParsed = parsed;
    } catch (apiError) {
      console.log('apiError', apiError);
      if (attempt > maxRetries) {
        const err = new Error(
          `OpenAI API error: ${apiError.message || 'Unknown error'}`
        );
        err.status = 502;
        err.code = 'OPENAI_API_ERROR';
        err.originalError = apiError;
        throw err;
      }
      continue;
    }
  }

  if (finalParsed === null) {
    if (!strictMode) {
      const textToCheck =
        `${title} ${description || ''} ${helperText || ''}`.toLowerCase();

      const hasComplexKeyword = complexKeywords.some((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(textToCheck);
      });
      const costsTwoCredits = hasComplexKeyword;

      return {
        isSimple: !costsTwoCredits,
        creditCost: costsTwoCredits ? 2 : 1,
        raw: rawText,
        fallback: true
      };
    }

    const err = new Error(
      'Unable to parse model output as boolean after retries'
    );
    err.status = 502;
    err.code = 'PARSING_FAILED';
    err.raw = rawText;
    throw err;
  }

  return {
    isSimple: finalParsed,
    creditCost: finalParsed ? 1 : 2,
    raw: rawText,
    fallback: false
  };
}
