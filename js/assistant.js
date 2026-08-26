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
  return `(Démo hors-ligne) Ta question — « ${userText} » — sera traitée par l'API Anthropic une fois la clé configurée dans js/api.js. Le contexte système de Ju Board est prêt à l'emploi.`;
}

function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const suggestions = document.getElementById('chat-suggestions');
  if (suggestions) suggestions.remove();

  appendMessage('user', trimmed);
  showTyping();

  window.setTimeout(() => {
    hideTyping();
    appendMessage('ai', mockAiReply(trimmed));
  }, 900);
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
