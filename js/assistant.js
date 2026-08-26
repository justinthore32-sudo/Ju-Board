/* ============================================
   JU BOARD — assistant.js
   Page Assistant : chat libre type iMessage
   ============================================ */

/* Contexte système injecté dans chaque message envoyé à l'API
   (branché lors de la connexion à l'API Anthropic — voir spec 8.3) */
const SYSTEM_PROMPT = `Tu es l'assistant personnel de Justin, curieux du monde et passionné
par l'économie, la géopolitique et la technologie.
Réponds en français, de manière claire, précise et pédagogique.
N'hésite pas à donner du contexte historique et des exemples concrets.
Pour les questions économiques, explique l'impact sur le monde réel.
Pour les questions géopolitiques, analyse les enjeux de puissance.
Priorise l'anticipation : quand c'est pertinent, indique ce qui est susceptible
de se passer ensuite (probabilités, horizon), pas seulement ce qui s'est déjà passé.
Reste factuel et nuancé — présente toujours plusieurs perspectives.`;

const history = [];

function scrollChatToBottom() {
  const win = document.getElementById('chat-window');
  win.scrollIntoView({ block: 'end' });
  window.scrollTo(0, document.body.scrollHeight);
}

function appendMessage(role, text) {
  const win = document.getElementById('chat-window');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;

  if (role === 'ai') {
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = 'JB';
    msg.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  msg.appendChild(bubble);

  win.appendChild(msg);
  history.push({ role, text });
  scrollChatToBottom();
  return msg;
}

function showTyping() {
  const win = document.getElementById('chat-window');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ai';
  msg.id = 'typing-msg';
  msg.innerHTML = `
    <div class="chat-avatar">JB</div>
    <div class="chat-bubble">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  win.appendChild(msg);
  scrollChatToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-msg');
  if (el) el.remove();
}

function mockAiReply(userText) {
  return `(Démo hors-ligne) Ta question — « ${userText} » — sera traitée par Claude une fois la clé API Anthropic configurée sur le Worker. Le contexte système de Ju Board est déjà prêt à l'emploi.`;
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const suggestions = document.getElementById('chat-suggestions');
  if (suggestions) suggestions.remove();

  appendMessage('user', trimmed);
  showTyping();

  const isProxyConfigured = typeof PROXY_URL === 'string' && !PROXY_URL.includes('YOUR-SUBDOMAIN');

  if (!isProxyConfigured || typeof callClaude !== 'function') {
    window.setTimeout(() => {
      hideTyping();
      appendMessage('ai', mockAiReply(trimmed));
    }, 900);
    return;
  }

  try {
    const apiMessages = history
      .filter((m) => m.role === 'user' || m.role === 'ai')
      .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
    apiMessages.push({ role: 'user', content: trimmed });

    const data = await callClaude(apiMessages, { system: SYSTEM_PROMPT, maxTokens: 1000 });
    hideTyping();
    const reply = data?.content?.[0]?.text || "Désolé, je n'ai pas pu générer de réponse.";
    appendMessage('ai', reply);
  } catch (err) {
    hideTyping();
    /* La clé Anthropic n'est pas encore configurée côté Worker (ANTHROPIC_API_KEY) —
       on retombe sur la réponse de démo plutôt que d'afficher une erreur brute. */
    appendMessage('ai', mockAiReply(trimmed));
  }
}

function initChatInput() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  const submit = () => {
    sendMessage(input.value);
    input.value = '';
  };

  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function initSuggestions() {
  document.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => sendMessage(chip.textContent));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initChatInput();
  initSuggestions();
});
