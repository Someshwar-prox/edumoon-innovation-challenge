// AIBridge Chatbot Widget
(function () {
  const AIBridgeChatbot = {
    config: {
      widgetId: null,
      apiUrl: 'http://localhost:3000',
      position: 'bottom-right',
      theme: 'dark',
    },

    init: function (options) {
      this.config = { ...this.config, ...options }

      if (!this.config.widgetId && !this.config.chatbotId) {
        console.error('AIBridge Chatbot: widgetId is required')
        return
      }
      
      // Fallback for older snippets
      if (this.config.chatbotId && !this.config.widgetId) {
        this.config.widgetId = this.config.chatbotId;
      }

      this.createWidget()
      this.attachEventListeners()
    },

    createWidget: function () {
      // Create container
      const container = document.createElement('div')
      container.id = 'aibridge-chatbot-widget'
      container.className = `aibridge-widget aibridge-${this.config.position}`

      // Create HTML structure
      container.innerHTML = `
        <style>
          :root {
            --ab-primary: oklch(0.5 0.25 275);
            --ab-bg: oklch(0.08 0 0);
            --ab-card: oklch(0.12 0 0);
            --ab-foreground: oklch(0.97 0 0);
            --ab-muted: oklch(0.25 0 0);
            --ab-border: oklch(0.2 0 0);
          }

          .aibridge-widget {
            position: fixed;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            z-index: 9999;
          }

          .aibridge-widget.aibridge-bottom-right {
            bottom: 20px;
            right: 20px;
          }

          .aibridge-widget.aibridge-bottom-left {
            bottom: 20px;
            left: 20px;
          }

          .aibridge-bubble {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--ab-primary);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          }

          .aibridge-bubble:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
          }

          .aibridge-bubble svg {
            width: 30px;
            height: 30px;
            color: white;
          }

          .aibridge-window {
            position: absolute;
            bottom: 90px;
            right: 0;
            width: 400px;
            max-height: 600px;
            background: var(--ab-card);
            border: 1px solid var(--ab-border);
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            display: none;
            flex-direction: column;
            overflow: hidden;
            animation: slideUp 0.3s ease;
          }

          .aibridge-widget.aibridge-bottom-left .aibridge-window {
            right: auto;
            left: 0;
          }

          .aibridge-window.visible {
            display: flex;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .aibridge-header {
            padding: 16px;
            background: var(--ab-primary);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--ab-border);
          }

          .aibridge-title {
            font-weight: 600;
            font-size: 14px;
          }

          .aibridge-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 20px;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .aibridge-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .aibridge-message {
            display: flex;
            gap: 8px;
            animation: fadeIn 0.3s ease;
          }

          .aibridge-message.user {
            justify-content: flex-end;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .aibridge-message-content {
            max-width: 70%;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.4;
          }

          .aibridge-message.assistant .aibridge-message-content {
            background: var(--ab-muted);
            color: var(--ab-foreground);
            border-radius: 8px 8px 8px 0;
          }

          .aibridge-message.user .aibridge-message-content {
            background: var(--ab-primary);
            color: white;
            border-radius: 8px 8px 0 8px;
          }

          .aibridge-input-area {
            padding: 12px;
            border-top: 1px solid var(--ab-border);
            display: flex;
            gap: 8px;
            background: var(--ab-bg);
          }

          .aibridge-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--ab-border);
            border-radius: 6px;
            background: var(--ab-card);
            color: var(--ab-foreground);
            font-size: 13px;
            font-family: inherit;
          }

          .aibridge-input::placeholder {
            color: var(--ab-muted);
          }

          .aibridge-send-btn {
            padding: 8px 12px;
            background: var(--ab-primary);
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s ease;
          }

          .aibridge-send-btn:hover {
            opacity: 0.9;
          }

          .aibridge-send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .aibridge-typing {
            display: flex;
            gap: 4px;
            padding: 10px 14px;
          }

          .aibridge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--ab-muted);
            animation: bounce 1.4s infinite;
          }

          .aibridge-dot:nth-child(2) {
            animation-delay: 0.2s;
          }

          .aibridge-dot:nth-child(3) {
            animation-delay: 0.4s;
          }

          @keyframes bounce {
            0%, 60%, 100% {
              opacity: 0.3;
              transform: translateY(0);
            }
            30% {
              opacity: 1;
              transform: translateY(-8px);
            }
          }
        </style>

        <button class="aibridge-bubble" aria-label="Open chatbot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <div class="aibridge-window">
          <div class="aibridge-header">
            <span class="aibridge-title">Chat with us</span>
            <button class="aibridge-close" aria-label="Close chatbot">×</button>
          </div>
          <div class="aibridge-messages"></div>
          <div class="aibridge-input-area">
            <input type="text" class="aibridge-input" placeholder="Type a message...">
            <button class="aibridge-send-btn" aria-label="Send message">→</button>
          </div>
        </div>
      `

      document.body.appendChild(container)
      this.widget = container
      this.messages = []
      this.conversationId = null
    },

    attachEventListeners: function () {
      const bubble = this.widget.querySelector('.aibridge-bubble')
      const closeBtn = this.widget.querySelector('.aibridge-close')
      const sendBtn = this.widget.querySelector('.aibridge-send-btn')
      const input = this.widget.querySelector('.aibridge-input')
      const chatWindow = this.widget.querySelector('.aibridge-window')

      bubble.addEventListener('click', () => {
        chatWindow.classList.toggle('visible')
        if (chatWindow.classList.contains('visible')) {
          input.focus()
          // Send initial greeting
          if (this.messages.length === 0) {
            this.addMessage('Hello! I am your AI assistant. How can I help you?', 'assistant')
          }
        }
      })

      closeBtn.addEventListener('click', () => {
        chatWindow.classList.remove('visible')
      })

      sendBtn.addEventListener('click', () => {
        this.sendMessage()
      })

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendMessage()
        }
      })
    },

    sendMessage: function () {
      const input = this.widget.querySelector('.aibridge-input')
      const message = input.value.trim()

      if (!message) return

      // Add user message
      this.addMessage(message, 'user')
      input.value = ''

      // Show typing indicator
      this.showTyping()

      // Function to handle sending message using session
      const doSend = (sessionId) => {
        fetch(`${this.config.apiUrl}/api/chat/${sessionId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: message, isFromUser: true }),
        })
          .then(() => {
            // Poll for response
            const deadline = Date.now() + 40000;
            const poll = () => {
              if (Date.now() > deadline) {
                this.removeTyping();
                this.addMessage('Service timeout.', 'assistant');
                return;
              }
              fetch(`${this.config.apiUrl}/api/chat/${sessionId}/messages`)
                .then(r => r.json())
                .then(data => {
                  const msgs = data.messages || [];
                  const last = msgs[msgs.length - 1];
                  if (last && !last.isFromUser) {
                    this.removeTyping();
                    this.addMessage(last.content, 'assistant');
                  } else {
                    setTimeout(poll, 1200);
                  }
                }).catch(() => setTimeout(poll, 1200));
            };
            setTimeout(poll, 1200);
          })
          .catch(err => {
            console.error('AIBridge:', err);
            this.removeTyping();
          });
      };

      if (!this.conversationId) {
        // Create session
        fetch(`${this.config.apiUrl}/api/chat/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widgetId: this.config.widgetId,
            visitorId: this.getVisitorId(),
          }),
        })
          .then(r => r.json())
          .then(data => {
            this.conversationId = data.chatSession.id;
            doSend(this.conversationId);
          })
          .catch(err => {
            console.error('AIBridge:', err);
            this.removeTyping();
          });
      } else {
        doSend(this.conversationId);
      }
    },

    addMessage: function (text, role) {
      this.messages.push({ text, role })

      const messagesContainer = this.widget.querySelector('.aibridge-messages')
      const messageEl = document.createElement('div')
      messageEl.className = `aibridge-message ${role}`
      messageEl.innerHTML = `<div class="aibridge-message-content">${this.escapeHtml(text)}</div>`

      messagesContainer.appendChild(messageEl)
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    },

    showTyping: function () {
      const messagesContainer = this.widget.querySelector('.aibridge-messages')
      const typingEl = document.createElement('div')
      typingEl.className = 'aibridge-message assistant aibridge-typing-indicator'
      typingEl.innerHTML = `
        <div class="aibridge-typing">
          <div class="aibridge-dot"></div>
          <div class="aibridge-dot"></div>
          <div class="aibridge-dot"></div>
        </div>
      `

      messagesContainer.appendChild(typingEl)
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    },

    removeTyping: function () {
      const typingEl = this.widget.querySelector('.aibridge-typing-indicator')
      if (typingEl) {
        typingEl.remove()
      }
    },

    getVisitorId: function () {
      let visitorId = localStorage.getItem('aibridge-visitor-id')
      if (!visitorId) {
        visitorId = 'visitor-' + Math.random().toString(36).substr(2, 9)
        localStorage.setItem('aibridge-visitor-id', visitorId)
      }
      return visitorId
    },

    escapeHtml: function (text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }
      return text.replace(/[&<>"']/g, (m) => map[m])
    },
  }

  // Expose to global scope
  window.AIBridgeChatbot = AIBridgeChatbot
})()
