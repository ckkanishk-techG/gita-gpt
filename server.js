require('dotenv').config();
const express = require('express');
const path = require('path');
const { getGitaReply } = require('./shared/gitaChat');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. See .env.example.' });
    }

    const result = await getGitaReply(GEMINI_API_KEY, message, history);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ reply: result.reply, model: result.model });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Gita GPT running at http://localhost:${PORT}`);
});
