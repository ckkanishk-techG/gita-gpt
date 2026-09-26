const chatEl = document.getElementById('chat');
const formEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

const history = [];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

// Converts a constrained markdown subset (bold, italic, code, blockquotes,
// bullet/numbered lists, horizontal rules, paragraphs) to sanitized HTML.
function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const htmlParts = [];
  let listType = null; // 'ul' | 'ol' | null
  let paragraphLines = [];
  let quoteLines = [];

  function flushParagraph() {
    if (paragraphLines.length) {
      htmlParts.push(`<p>${renderInline(paragraphLines.join(' '))}</p>`);
      paragraphLines = [];
    }
  }
  function flushList() {
    if (listType) {
      htmlParts.push(`</${listType}>`);
      listType = null;
    }
  }
  function flushQuote() {
    if (quoteLines.length) {
      htmlParts.push(`<blockquote>${quoteLines.map(renderInline).join('<br>')}</blockquote>`);
      quoteLines = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    if (/^([-*_]\s*){3,}$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      htmlParts.push('<hr>');
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }
    flushQuote();

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)$/);

    if (bulletMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        htmlParts.push('<ul>');
        listType = 'ul';
      }
      htmlParts.push(`<li>${renderInline(bulletMatch[1])}</li>`);
      continue;
    }

    if (numberedMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        htmlParts.push('<ol>');
        listType = 'ol';
      }
      htmlParts.push(`<li>${renderInline(numberedMatch[1])}</li>`);
      continue;
    }

    flushList();

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  flushQuote();

  return htmlParts.join('\n');
}

function addMessage(text, role) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role.includes('bot') || role === 'error') {
    div.innerHTML = markdownToHtml(text);
  } else {
    div.textContent = text;
  }
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

addMessage(
  'Namaste. Ask me anything — from daily life to the deepest questions — and I will answer, then show you what the Bhagavad Gita has to say about it.',
  'bot'
);

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = inputEl.value.trim();
  if (!message) return;

  addMessage(message, 'user');
  inputEl.value = '';
  inputEl.disabled = true;
  sendBtn.disabled = true;

  const loadingEl = addMessage('Reflecting on the verses...', 'bot loading');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    const data = await res.json();

    loadingEl.remove();

    if (!res.ok) {
      addMessage(data.error || 'Something went wrong.', 'error');
    } else {
      addMessage(data.reply, 'bot');
      history.push({ role: 'user', text: message });
      history.push({ role: 'model', text: data.reply });
    }
  } catch (err) {
    loadingEl.remove();
    addMessage('Network error — is the server running?', 'error');
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
});
