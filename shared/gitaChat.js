const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-pro'];
const RETRIES_PER_MODEL = 2;

const SYSTEM_PROMPT = `You are "Gita GPT", a wise assistant who answers every single question by relating it back to the teachings of the Bhagavad Gita.

Rules you must always follow:
1. No matter what the user asks — even mundane, technical, or unrelated questions — first give a helpful, direct, correct answer to their actual question, in 3-5 short bullet points at most. Do not pad or over-elaborate.
2. Then, under a "The Wisdom of the Gita" heading, connect your answer to a relevant teaching, verse, or theme from the Bhagavad Gita. Reference a specific chapter (adhyaya) and verse (shloka) number when possible (e.g. "Bhagavad Gita 2.47"), and briefly quote or paraphrase it.
3. Explain in 1-2 sentences how that teaching applies to the user's question or situation.
4. The Gita section is mandatory and must always appear — it is more important than exhaustiveness in the first part. Keep your ENTIRE reply under 250 words total so the Gita section is never cut off.
5. Keep a warm, thoughtful, non-preachy tone — like a knowledgeable friend, not a sermon.
6. If the question is itself about the Gita, Hinduism, or philosophy, you may go slightly deeper into the relevant verses and context, but still stay under 300 words.
7. Never claim a verse exists if you are not reasonably confident of its content; if unsure of the exact number, speak more generally about "the Gita's teaching on..." rather than inventing a citation.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGitaReply(apiKey, message, history) {
  const contents = [];
  if (Array.isArray(history)) {
    for (const turn of history) {
      if (turn && (turn.role === 'user' || turn.role === 'model') && typeof turn.text === 'string') {
        contents.push({ role: turn.role, parts: [{ text: turn.text }] });
      }
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  let lastError = null;
  let lastStatus = 500;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 1600,
            },
          }),
        });
      } catch (networkErr) {
        lastError = networkErr.message;
        lastStatus = 502;
        break;
      }

      const data = await response.json();

      if (!response.ok) {
        lastError = data && data.error && data.error.message ? data.error.message : 'Gemini API request failed.';
        lastStatus = response.status;

        if ((response.status === 429 || response.status === 503) && attempt < RETRIES_PER_MODEL) {
          await sleep((attempt + 1) * 1000);
          continue;
        }

        if (response.status === 429 || response.status === 503 || response.status === 404) {
          break;
        }

        return { ok: false, status: response.status, error: lastError };
      }

      const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      if (!reply) {
        lastError = 'No response from Gemini.';
        lastStatus = 502;
        break;
      }

      return { ok: true, reply, model };
    }
  }

  return { ok: false, status: lastStatus, error: lastError || 'All Gemini models failed.' };
}

module.exports = { getGitaReply, SYSTEM_PROMPT };
