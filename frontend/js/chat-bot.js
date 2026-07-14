/* ──────────────────────────────────────────────────────────
   SMART BILL OPTIMIZER - AI ENERGY ASSISTANT FLOATING CHAT JS
   ────────────────────────────────────────────────────────── */

(function () {
    // 1. Check if user is logged in
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    const uid = localStorage.getItem('userUid');

    if (!isLoggedIn || !uid) {
        console.log("💬 Chatbot disabled: User is not authenticated.");
        return;
    }

    // 2. Load the stylesheet dynamically to avoid cluttering HTML head elements
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/floating-chat.css?v=" + new Date().getTime();
    document.head.appendChild(link);

    // 3. Inject Chat HTML structures when the DOM is ready
    function initChatbot() {
        // Chat box must always start closed on page load/refresh
        const isOpen = false;

        // Create Launcher Bubble
        const launcher = document.createElement("button");
        launcher.className = "chat-launcher notransition"; // Block transitions on mount
        launcher.id = "chatLauncher";
        launcher.title = "AI Energy Assistant";
        launcher.innerHTML = '<i class="fa-solid fa-robot"></i>';
        
        document.body.appendChild(launcher);

        // Create Chat Widget Box
        const widget = document.createElement("div");
        widget.className = "chat-widget notransition"; // Block transitions on mount
        widget.id = "chatWidget";
        widget.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-header-title">
                        <i class="fa fa-robot"></i> AI Energy Assistant
                        <span class="chat-status-dot"></span>
                    </div>
                    <div class="chat-header-subtitle">Smart Energy Companion</div>
                </div>
                <div class="chat-header-actions">
                    <button class="chat-action-btn" id="chatResetBtn" title="Reset Conversation">
                        <i class="fa fa-rotate"></i>
                    </button>
                    <button class="chat-close-btn" id="chatCloseBtn" title="Close Chat">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="chat-bg-watermark" id="chatBgWatermark">
                    <i class="fa fa-leaf"></i>
                </div>
            </div>
            <div class="chat-footer">
                <form class="chat-input-form" id="chatInputForm">
                    <textarea class="chat-input" id="chatInput" placeholder="Ask about saving energy..." autocomplete="off" rows="1"></textarea>
                    <button type="submit" class="chat-send-btn" id="chatSendBtn">
                        <i class="fa fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;
        
        document.body.appendChild(widget);

        // Force browser layout calculation to lock baseline state without animations
        widget.offsetHeight;
        launcher.offsetHeight;

        // Release transition block after a brief delay to prevent paint-phase animation triggers on mount
        setTimeout(() => {
            widget.classList.remove("notransition");
            launcher.classList.remove("notransition");
        }, 150);

        // DOM elements
        const chatMessages = document.getElementById("chatMessages");
        const chatInputForm = document.getElementById("chatInputForm");
        const chatInput = document.getElementById("chatInput");
        const chatSendBtn = document.getElementById("chatSendBtn");
        const chatCloseBtn = document.getElementById("chatCloseBtn");
        const chatResetBtn = document.getElementById("chatResetBtn");

        // Auto-expand textarea on input
        chatInput.addEventListener("input", function () {
            this.style.height = "auto";
            const maxHeight = 100;
            const newHeight = Math.min(this.scrollHeight, maxHeight);
            this.style.height = newHeight + "px";
            if (this.scrollHeight > maxHeight) {
                this.style.overflowY = "auto";
            } else {
                this.style.overflowY = "hidden";
            }
        });

        // Submit form on Enter key press (insert newline on Shift + Enter)
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatInputForm.dispatchEvent(new Event("submit"));
            }
        });

        // Show scrollbar only while scrolling, hide after 1 second of inactivity
        let scrollTimeout;
        chatInput.addEventListener("scroll", () => {
            chatInput.classList.add("scrolling");
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                chatInput.classList.remove("scrolling");
            }, 1000);
        });

        // Setup cache key unique to logged-in user UID
        const cacheKey = "ssuet_chat_history_" + uid;

        // Load History from sessionStorage
        let chatHistory = [];
        try {
            const cachedHistory = sessionStorage.getItem(cacheKey);
            if (cachedHistory) {
                chatHistory = JSON.parse(cachedHistory);
            }
        } catch (e) {
            console.error("Error loading chat cache", e);
        }

        // Render conversation history or default welcome
        const defaultWelcome = "Hello! I am your AI Energy Assistant. Ask me any question about your electricity usage, NEPRA slab limits, or cost-saving strategies.";
        
        function renderWelcomeCard() {
            const card = document.createElement("div");
            card.className = "chat-welcome-container";
            card.id = "chatWelcomeCard";
            card.innerHTML = `
                <div class="chat-welcome-icon">
                    <i class="fa fa-leaf"></i>
                </div>
                <div class="chat-welcome-brand">Bill Optimizer <span class="chat-welcome-ai-tag">AI</span></div>
                <p class="chat-welcome-text">${defaultWelcome}</p>
            `;
            chatMessages.appendChild(card);
        }

        function renderInitialMessages() {
            const watermark = document.getElementById("chatBgWatermark") || document.createElement("div");
            if (!watermark.id) {
                watermark.className = "chat-bg-watermark";
                watermark.id = "chatBgWatermark";
                watermark.innerHTML = '<i class="fa fa-leaf"></i>';
            }
            chatMessages.innerHTML = "";
            chatMessages.appendChild(watermark);

            if (chatHistory.length > 0) {
                chatMessages.classList.add("has-chat");
                chatHistory.forEach(msg => appendBubble(msg.text, msg.role));
            } else {
                chatMessages.classList.remove("has-chat");
                renderWelcomeCard();
            }
            scrollToBottom();
        }
        
        renderInitialMessages();

        // 4. Widget Toggling Events
        launcher.addEventListener("click", () => {
            widget.classList.toggle("visible");
            launcher.classList.toggle("active");
            const isVisible = widget.classList.contains("visible");
            if (isVisible) {
                chatInput.focus();
                scrollToBottom();
            }
        });

        chatCloseBtn.addEventListener("click", () => {
            widget.classList.remove("visible");
            launcher.classList.remove("active");
        });

        // Close when clicking outside the widget container
        document.addEventListener("click", (e) => {
            if (widget.classList.contains("visible") &&
                !widget.contains(e.target) &&
                !launcher.contains(e.target)) {
                widget.classList.remove("visible");
                launcher.classList.remove("active");
            }
        });

        // Reset Chat Action
        chatResetBtn.addEventListener("click", () => {
            chatHistory = [];
            sessionStorage.removeItem(cacheKey);
            renderInitialMessages();
            chatInput.focus();
        });

        // 5. Submit Message Event
        chatInputForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const messageText = chatInput.value.trim();
            if (!messageText) return;

            // Remove welcome card if user initiates messaging
            const welcomeCard = document.getElementById("chatWelcomeCard");
            if (welcomeCard) welcomeCard.remove();

            // Show background watermark
            chatMessages.classList.add("has-chat");

            // Render User Bubble
            appendBubble(messageText, "user");
            chatInput.value = "";
            chatInput.style.height = "auto";
            chatInput.style.overflowY = "hidden";
            chatInput.disabled = true;
            chatSendBtn.disabled = true;
            
            // Create the model response bubble ahead of time displaying loading dots
            const replyBubble = document.createElement("div");
            replyBubble.className = "chat-bubble model";
            replyBubble.id = "chatPendingReply";
            replyBubble.innerHTML = `
                <div class="chat-typing-dots">
                    <div class="chat-dot"></div>
                    <div class="chat-dot"></div>
                    <div class="chat-dot"></div>
                </div>
            `;
            chatMessages.appendChild(replyBubble);
            scrollToBottom();

            // Prepare Payload history format: [{'role': 'user'|'model', 'text': '...'}]
            const formattedHistory = chatHistory.map(h => ({
                role: h.role,
                text: h.text
            }));

            try {
                // Post payload to backend chat endpoint
                const url = (typeof API_BASE_URL !== "undefined") ? `${API_BASE_URL}/api/chat` : "http://127.0.0.1:5001/api/chat";
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        uid: uid,
                        message: messageText,
                        history: formattedHistory,
                        page: window.location.pathname,
                        platform: "web"
                    })
                });

                const data = await res.json();
                
                const pendingBubble = document.getElementById("chatPendingReply");
                if (data.status === "success" && data.reply) {
                    if (pendingBubble) {
                        pendingBubble.removeAttribute("id");
                        const html = formatMarkdown(data.reply);
                        
                        typewriteHTML(pendingBubble, html, 6, () => {
                            chatInput.disabled = false;
                            chatSendBtn.disabled = false;
                            chatInput.focus();
                        });
                    } else {
                        appendBubble(data.reply, "model");
                        chatInput.disabled = false;
                        chatSendBtn.disabled = false;
                        chatInput.focus();
                    }
                    
                    // Save to cache history
                    chatHistory.push({ role: "user", text: messageText });
                    chatHistory.push({ role: "model", text: data.reply });
                    sessionStorage.setItem(cacheKey, JSON.stringify(chatHistory));
                } else {
                    const errMsg = data.error || "Could not retrieve response from AI. Please try again.";
                    if (pendingBubble) {
                        pendingBubble.removeAttribute("id");
                        pendingBubble.innerHTML = `⚠️ Error: ${errMsg}`;
                    } else {
                        appendBubble(`⚠️ Error: ${errMsg}`, "model");
                    }
                    chatInput.disabled = false;
                    chatSendBtn.disabled = false;
                    chatInput.focus();
                }
            } catch (err) {
                const pendingBubble = document.getElementById("chatPendingReply");
                if (pendingBubble) {
                    pendingBubble.removeAttribute("id");
                    pendingBubble.innerHTML = "⚠️ Connection failure. Make sure your Python Flask backend is running on port 5001.";
                } else {
                    appendBubble("⚠️ Connection failure. Make sure your Python Flask backend is running on port 5001.", "model");
                }
                chatInput.disabled = false;
                chatSendBtn.disabled = false;
                chatInput.focus();
                console.error("Chatbot Fetch Error:", err);
            }

            scrollToBottom();
        });

        function formatMarkdown(text) {
            // Escape HTML to prevent XSS
            let html = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            
            // Parse bold markdown (**text**)
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            
            // Parse markdown links [Text](url) to HTML anchors
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

            // Parse bullet lists (* or - at start of line)
            if (html.includes('\n* ') || html.includes('\n- ') || html.startsWith('* ') || html.startsWith('- ')) {
                html = html.replace(/^(?:[\*\-]\s|\-\s)(.+)$/gm, '<li>$1</li>');
                // Wrap consecutive <li> tags in <ul> tags
                html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');
            }
            
            // Parse line breaks
            html = html.replace(/\n/g, '<br>');
            
            // Clean up list layouts
            html = html.replace(/<br><ul>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
            
            return html;
        }

        function typewriteHTML(element, html, speed = 6, onComplete) {
            let i = 0;
            element.innerHTML = "";
            
            function step() {
                if (i < html.length) {
                    // Check if scroll is near bottom BEFORE we update layout
                    const threshold = 55;
                    const isNearBottom = (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) <= threshold;

                    // Instantly write complete HTML tags to prevent syntax breaking mid-animation
                    if (html.charAt(i) === '<') {
                        let tagCloseIndex = html.indexOf('>', i);
                        if (tagCloseIndex !== -1) {
                            i = tagCloseIndex + 1;
                        } else {
                            i++;
                        }
                    } else {
                        i++;
                    }
                    element.innerHTML = html.substring(0, i);
                    
                    // Only scroll down if the user was already near the bottom
                    if (isNearBottom) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                    
                    setTimeout(step, speed);
                } else {
                    if (onComplete) onComplete();
                }
            }
            step();
        }

        function appendBubble(text, role) {
            const bubble = document.createElement("div");
            bubble.className = `chat-bubble ${role}`;
            
            if (role === "model") {
                bubble.innerHTML = formatMarkdown(text);
            } else {
                bubble.textContent = text;
            }
            chatMessages.appendChild(bubble);
        }

        function scrollToBottom() {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Listen for Firebase signOut event to immediately clear chat cache
        if (window.firebase) {
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    for (let i = sessionStorage.length - 1; i >= 0; i--) {
                        const key = sessionStorage.key(i);
                        if (key && key.startsWith("ssuet_chat_history")) {
                            sessionStorage.removeItem(key);
                        }
                    }
                }
            });
        }
    }

    // Attach load listener
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChatbot);
    } else {
        initChatbot();
    }
})();
