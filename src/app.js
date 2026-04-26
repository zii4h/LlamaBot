
(() => {
  "use strict";

  const panel        = document.getElementById("cw-panel");
  const bubbleBtn    = document.getElementById("cw-bubble-btn");
  const badge        = document.getElementById("cw-badge");
  const closeBtn     = document.getElementById("cw-close");
  const input        = document.getElementById("cw-input");
  const sendBtn      = document.getElementById("cw-send");
  const messagesEl   = document.getElementById("cw-messages");
  const typingEl     = document.getElementById("cw-typing");
  const quickReplies = document.getElementById("cw-quick-replies");
  const statusDot    = document.getElementById("cw-status-dot");
  const statusText   = document.getElementById("cw-status-text");
  const botNameEl    = document.getElementById("cw-bot-name");
  const welcomeMsg   = document.getElementById("cw-welcome-msg");

  let isOpen       = false;
  let isLoading    = false;
  let ollamaOnline = false;
  let chatHistory  = [];

  function init() {

    botNameEl.textContent = CONFIG.botName;
    welcomeMsg.textContent =
      `👋 Hi! I'm ${CONFIG.botName}. Ask me anything about ${CONFIG.siteName}!`;

    checkOllamaStatus();

    setInterval(checkOllamaStatus, 30000);
  }

  async function checkOllamaStatus() {
    try {
      const res = await fetch(`${CONFIG.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        const models = data.models || [];
        const hasModel = models.some(m => m.name.startsWith(CONFIG.model));

        if (hasModel) {
          
          //setStatus("online", `Online · ${CONFIG.model}`); 
          setStatus("online", `Online`);
          ollamaOnline = true;
        } else {
          setStatus("error", `Run: ollama pull ${CONFIG.model}`);
          ollamaOnline = false;
        }
      } else {
        setStatus("error", "Ollama not found");
        ollamaOnline = false;
      }
    } catch {
      setStatus("error", "Start Ollama app first");
      ollamaOnline = false;
    }
  }

  function setStatus(state, text) {
    statusDot.className  = `cw-dot ${state}`;
    statusText.textContent = text;
  }

  bubbleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) {
      badge.style.display = "none";
      setTimeout(() => input.focus(), 100);
    }
  });

  closeBtn.addEventListener("click", () => {
    isOpen = false;
    panel.classList.remove("open");
  });

  function appendMsg(text, who) {
    const d = document.createElement("div");
    d.className = `cw-msg ${who}`;
    d.textContent = text;
    messagesEl.appendChild(d);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (!isOpen && who === "bot") {
      badge.style.display = "block";
    }
  }

  function setLoading(loading) {
    isLoading         = loading;
    input.disabled    = loading;
    sendBtn.disabled  = loading;
    typingEl.classList.toggle("show", loading);
    if (loading) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function trimHistory() {
    if (chatHistory.length > CONFIG.maxHistoryMessages) {
      chatHistory = chatHistory.slice(-CONFIG.maxHistoryMessages);
    }
  }

  async function sendMsg(text) {
    text = text.trim();
    if (!text || isLoading) return;

    if (!ollamaOnline) {
      appendMsg(
        "Ollama isn't running. Open the Ollama app on your PC, then refresh this page.",
        "err"
      );
      return;
    }

    appendMsg(text, "user");
    input.value = "";
    quickReplies.style.display = "none";
    setLoading(true);

    chatHistory.push({ role: "user", content: text });
    trimHistory();

    try {
      const res = await fetch(`${CONFIG.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: [
            { role: "system", content: CONFIG.systemPrompt },
            ...chatHistory,
          ],
          stream: false,
          options: {
            num_predict: CONFIG.maxTokens,
            temperature: 0.7,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data  = await res.json();
      const reply = data?.message?.content?.trim()
        || "Sorry, I didn't get a response. Please try again!";

      chatHistory.push({ role: "assistant", content: reply });
      appendMsg(reply, "bot");

    } catch (err) {
      chatHistory.pop(); // remove failed user message from history
      appendMsg(
        `Error: ${err.message}. Make sure Ollama is running and the model is downloaded.`,
        "err"
      );
      console.error("[Chatbot] Ollama error:", err);
    } finally {
      setLoading(false);
    }
  }

  window.sendQuick = (text) => sendMsg(text);

  sendBtn.addEventListener("click", () => sendMsg(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg(input.value);
    }
  });

  init();

})();
