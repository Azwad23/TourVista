/* ============================================
   AI Chatbot Widget
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  initChatbot();
});

function initChatbot() {
  // Inject chatbot HTML into the page
  const chatbotHTML = `
    <button class="chatbot-trigger" id="chatbotTrigger" onclick="toggleChatbot()">
      <i class="fas fa-robot"></i>
      <span class="badge-dot"></span>
    </button>

    <div class="chatbot-panel" id="chatbotPanel">
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="bot-avatar"><i class="fas fa-robot"></i></div>
          <div>
            <h4>TourBot AI</h4>
            <p><i class="fas fa-circle" style="font-size:6px; color:#4ade80; margin-right:4px"></i> Online</p>
          </div>
        </div>
        <button class="chatbot-close" onclick="toggleChatbot()">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="chatbot-messages" id="chatbotMessages">
        <div class="chat-message bot">
          <div class="chat-avatar"><i class="fas fa-robot"></i></div>
          <div class="chat-bubble">
            Hi there! 👋 I'm TourBot, your travel assistant. I can help you with:
            <br><br>
            🗓️ <strong>Event information</strong><br>
            📝 <strong>Registration guidance</strong><br>
            🧭 <strong>Platform navigation</strong>
            <br><br>
            How can I assist you today?
          </div>
        </div>
      </div>

      <div class="chatbot-quick-actions" style="padding: 0 16px 8px; display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:4px 10px; border-radius:20px;" onclick="quickChat('What events are available?')">📅 Available events</button>
        <button class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:4px 10px; border-radius:20px;" onclick="quickChat('How do I register?')">📝 How to register</button>
        <button class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:4px 10px; border-radius:20px;" onclick="quickChat('Pricing info')">💰 Pricing</button>
      </div>

      <div class="chatbot-input">
        <input type="text" id="chatbotInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter')sendChatMessage()">
        <button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', chatbotHTML);
}

function toggleChatbot() {
  const panel = document.getElementById('chatbotPanel');
  const trigger = document.getElementById('chatbotTrigger');

  panel.classList.toggle('open');

  if (panel.classList.contains('open')) {
    trigger.innerHTML = '<i class="fas fa-times"></i>';
    document.getElementById('chatbotInput').focus();
  } else {
    trigger.innerHTML = '<i class="fas fa-robot"></i><span class="badge-dot"></span>';
  }
}

function quickChat(message) {
  document.getElementById('chatbotInput').value = message;
  sendChatMessage();
}

// Generate or retrieve a chat session ID
function getChatSessionId() {
  let sid = sessionStorage.getItem('chatbot_session');
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('chatbot_session', sid);
  }
  return sid;
}

async function sendChatMessage() {
  const input = document.getElementById('chatbotInput');
  const text = input.value.trim();
  if (!text) return;

  addChatMessage('user', text);
  input.value = '';

  // Show typing indicator
  const messages = document.getElementById('chatbotMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message bot';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = `
    <div class="chat-avatar"><i class="fas fa-robot"></i></div>
    <div class="chat-bubble" style="display:flex;gap:4px;padding:16px;">
      <span class="typing-dot" style="width:8px;height:8px;border-radius:50%;background:var(--text-muted);animation:typingBounce 1s infinite;animation-delay:0s"></span>
      <span class="typing-dot" style="width:8px;height:8px;border-radius:50%;background:var(--text-muted);animation:typingBounce 1s infinite;animation-delay:0.2s"></span>
      <span class="typing-dot" style="width:8px;height:8px;border-radius:50%;background:var(--text-muted);animation:typingBounce 1s infinite;animation-delay:0.4s"></span>
    </div>
  `;
  messages.appendChild(typingDiv);
  messages.scrollTop = messages.scrollHeight;

  try {
    // Call backend AI chatbot API
    if (typeof ChatbotAPI !== 'undefined') {
      const data = await ChatbotAPI.sendMessage(text, getChatSessionId());
      const typing = document.getElementById('typing-indicator');
      if (typing) typing.remove();
      addChatMessage('bot', data.botMessage || data.response || 'Sorry, I couldn\'t process that.');
    } else {
      // Fallback if API module not loaded
      setTimeout(() => {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        addChatMessage('bot', 'I\'m having trouble connecting. Please refresh the page and try again, or email <strong>support@tourvista.com</strong>.');
      }, 800);
    }
  } catch (err) {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
    addChatMessage('bot', 'Oops, something went wrong. Please try again or contact <strong>support@tourvista.com</strong>.');
  }
}

function addChatMessage(sender, text) {
  const messages = document.getElementById('chatbotMessages');
  const msg = document.createElement('div');
  msg.className = `chat-message ${sender}`;
  msg.innerHTML = `
    <div class="chat-avatar"><i class="fas fa-${sender === 'bot' ? 'robot' : 'user'}"></i></div>
    <div class="chat-bubble">${text}</div>
  `;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

// Add typing animation keyframes
const typingStyle = document.createElement('style');
typingStyle.textContent = `
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }
`;
document.head.appendChild(typingStyle);
