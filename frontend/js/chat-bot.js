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
    link.href = "css/floating-chat.css";
    document.head.appendChild(link);

    // 3. Inject Chat HTML structures when the DOM is ready
    function initChatbot() {
        // Create Launcher Bubble
        const launcher = document.createElement("button");
        launcher.className = "chat-launcher";
        launcher.id = "chatLauncher";
        launcher.title = "AI Energy Assistant";
        launcher.innerHTML = '<i class="fa-solid fa-robot"></i>';
        document.body.appendChild(launcher);

        // Create Chat Widget Box
        const widget = document.createElement("div");
        widget.className = "chat-widget";
        widget.id = "chatWidget";
        widget.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-header-title">
                        <i class="fa fa-robot"></i> AI Energy Assistant
                        <span class="chat-status-dot"></span>
                    </div>
                    <div class="chat-header-subtitle">SSUET ML Optimizer Core</div>
                </div>
                <button class="chat-close-btn" id="chatCloseBtn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="chat-messages" id="chatMessages"></div>
            <div class="chat-typing-container" id="chatTypingContainer">
                <div class="chat-typing-dots">
                    <div class="chat-dot"></div>
                    <div class="chat-dot"></div>
                    <div class="chat-dot"></div>
                </div>
            </div>
            <div class="chat-footer">
                <form class="chat-input-form" id="chatInputForm">
                    <input type="text" class="chat-input" id="chatInput" placeholder="Ask about saving energy..." autocomplete="off" required>
                    <button type="submit" class="chat-send-btn" id="chatSendBtn">
                        <i class="fa fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(widget);

        // DOM elements
        const chatMessages = document.getElementById("chatMessages");
        const chatInputForm = document.getElementById("chatInputForm");
        const chatInput = document.getElementById("chatInput");
        const chatSendBtn = document.getElementById("chatSendBtn");
        const chatTypingContainer = document.getElementById("chatTypingContainer");
        const chatCloseBtn = document.getElementById("chatCloseBtn");

        // Load History from sessionStorage
        let chatHistory = [];
        try {
            const cachedHistory = sessionStorage.getItem("ssuet_chat_history");
            if (cachedHistory) {
                chatHistory = JSON.parse(cachedHistory);
            }
        } catch (e) {
            console.error("Error loading chat cache", e);
        }

        // Render conversation history or default welcome
        if (chatHistory.length > 0) {
            chatHistory.forEach(msg => appendBubble(msg.text, msg.role));
        } else {
            const welcomeText = "Hello! I am your SSUET AI Energy Assistant. I have analyzed your inventory and NEPRA July 2026 predictions. Ask me anything about slab limits, cost reductions, or how to save units!";
            appendBubble(welcomeText, "model");
        }
        scrollToBottom();

        // 4. Widget Open/Close Events
        launcher.addEventListener("click", () => {
            widget.classList.toggle("visible");
            launcher.classList.toggle("active");
            if (widget.classList.contains("visible")) {
                chatInput.focus();
                scrollToBottom();
            }
        });

        chatCloseBtn.addEventListener("click", () => {
            widget.classList.remove("visible");
            launcher.classList.remove("active");
        });

        // 5. Submit Message Event
        chatInputForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const messageText = chatInput.value.trim();
            if (!messageText) return;

            // Render User Bubble
            appendBubble(messageText, "user");
            chatInput.value = "";
            chatInput.disabled = true;
            chatSendBtn.disabled = true;
            
            // Show typing indicator
            chatTypingContainer.style.display = "block";
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
                        page: window.location.pathname
                    })
                });

                const data = await res.json();
                
                chatTypingContainer.style.display = "none";
                chatInput.disabled = false;
                chatSendBtn.disabled = false;
                chatInput.focus();

                if (data.status === "success" && data.reply) {
                    appendBubble(data.reply, "model");
                    // Save to cache history
                    chatHistory.push({ role: "user", text: messageText });
                    chatHistory.push({ role: "model", text: data.reply });
                    sessionStorage.setItem("ssuet_chat_history", JSON.stringify(chatHistory));
                } else {
                    const errMsg = data.error || "Could not retrieve response from AI. Please try again.";
                    appendBubble(`⚠️ Error: ${errMsg}`, "model");
                }
            } catch (err) {
                chatTypingContainer.style.display = "none";
                chatInput.disabled = false;
                chatSendBtn.disabled = false;
                chatInput.focus();
                appendBubble("⚠️ Connection failure. Make sure your Python Flask backend is running on port 5001.", "model");
                console.error("Chatbot Fetch Error:", err);
            }

            scrollToBottom();
        });

        // 6. Formatting Helper functions
        function appendBubble(text, role) {
            const bubble = document.createElement("div");
            bubble.className = `chat-bubble ${role}`;
            
            if (role === "model") {
                // Convert markdown bullet points to HTML
                let htmlContent = text;
                // Parse bullet points
                if (htmlContent.includes("\n* ") || htmlContent.includes("\n- ")) {
                    htmlContent = htmlContent.replace(/\n[\*\-]\s([^\n]+)/g, '<li>$1</li>');
                    htmlContent = htmlContent.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
                }
                bubble.innerHTML = htmlContent;
            } else {
                bubble.textContent = text;
            }
            chatMessages.appendChild(bubble);
        }

        function scrollToBottom() {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Attach load listener
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChatbot);
    } else {
        initChatbot();
    }
})();
