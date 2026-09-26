const { getGitaReply } = require('../../shared/gitaChat');

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const message = body && body.message;
    const history = body && body.history;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return Response.json({ error: 'Message is required.' }, { status: 400 });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'Server is missing GEMINI_API_KEY.' }, { status: 500 });
    }

    const result = await getGitaReply(apiKey, message, history);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ reply: result.reply, model: result.model });
  } catch (err) {
    return Response.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
