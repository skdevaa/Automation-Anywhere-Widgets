export default {
  /**
   * Global configuration for the chat widget and backend connectivity.
   *
   * @property {string} baseURL - Base URL of the chat/backend API.
   * @property {string} apiKey - API key for authenticating requests.
   * @property {string} secret - Secret/token for additional authentication.
   * @property {string} projectId - Project identifier used by the backend.
   * @property {string} title - Widget title / header text.
   * @property {string} agentId - ID of the agent used for this chat.
   * @property {("yes"|"no")} emoji - Flag controlling emoji support in the UI.
   * @property {string} chatName - Name/label of the chat session.
   * @property {string} chatId - Current chat session ID.
   * @property {boolean} persist - Whether to persist chat state using `storeValue`.
   * @property {string} textColor - Text color for the widget UI.
   * @property {Array<{sender: "user"|"bot", text: string}>} messages - In-memory message history.
   */
  config: {
    baseURL: inputs.baseURL,
    apiKey: inputs.apiKey,
    secret: inputs.secret,
    projectId: inputs.projectId,
    title: inputs.title,
    agentId: inputs.agentId,
    emoji: "no",
    chatName: inputs.chatName,
    chatId: "",
    persist:
      typeof inputs.persist === "boolean"
        ? inputs.persist
        : /^(?:true|1|yes|y|on)$/i.test(
            (inputs.persist ?? "").toString().trim()
          ),
    textColor: inputs.textColor,
    messages: []
  },

  /**
   * Lifecycle hook to initialize the chat widget when it loads.
   *
   * Behavior:
   * - If no `chatId` exists, creates a new chat via `AA_CreateChat`.
   * - Stores initial state (`messages`, `chatId`, `agentId`) using `storeValue`.
   * - If `chatId` exists, re-persists the current messages and metadata.
   *
   * Errors are caught and optionally loggable in the host environment.
   *
   * @returns {Promise<void>}
   */
  async onLoad() {
    try {
      if (this.config.chatId === "") {
        const response = await AA_CreateChat.run({
          baseURL: this.config.baseURL,
          apiKey: this.config.apiKey,
          secret: this.config.secret,
          projectId: this.config.projectId,
          agentId: this.config.agentId,
          chatName: this.config.chatName
        });

        this.config.chatId = response?.chat_id || this.config.chatId;

        await storeValue(
          "ChatWidget",
          {
            messages: [],
            chatId: this.config.chatId,
            agentId: this.config.agentId
          },
          this.config.persist
        );

        this.config.messages = [];
      } else {
        const prior = this.config.messages;

        await storeValue(
          "ChatWidget",
          {
            messages: prior,
            chatId: this.config.chatId,
            agentId: this.config.agentId
          },
          this.config.persist
        );
      }
    } catch (e) {
      // Optional: console.error("onLoad error:", e);
    }
  },

  /**
   * Start a new chat session.
   *
   * - Calls `AA_CreateChat` to create a new chat.
   * - Updates `chatId` from the response when available.
   * - Clears local message history.
   * - Persists the new (empty) state via `storeValue`.
   *
   * @returns {Promise<void>}
   */
  async newChat() {
    const response = await AA_CreateChat.run({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      secret: this.config.secret,
      projectId: this.config.projectId,
      agentId: this.config.agentId,
      chatName: this.config.chatName
    });

    this.config.chatId = response?.chat_id || this.config.chatId;

    await storeValue(
      "ChatWidget",
      {
        messages: [],
        chatId: this.config.chatId,
        agentId: this.config.agentId
      },
      this.config.persist
    );

    this.config.messages = [];
  },

  /**
   * Handle upload-like user input as a chat message.
   *
   * - Appends a user message to the current history.
   * - Persists the updated messages, `chatId`, and `agentId`.
   *
   * @param {string} message - Content of the user message (e.g., uploaded text or info).
   * @returns {Promise<void>}
   */
  async onUpload(message) {
    const prior = this.config.messages;
    const messages = [...prior, { sender: "user", text: message }];

    await storeValue(
      "ChatWidget",
      {
        messages,
        chatId: this.config.chatId,
        agentId: this.config.agentId
      },
      this.config.persist
    );

    this.config.messages = messages;
  },

  /**
   * Handle a send interaction by updating message history.
   *
   * Flow:
   * 1. Append the user message.
   * 2. Persist updated state.
   * 3. Append the bot response.
   * 4. Persist final updated state.
   *
   * @param {string} message - User's message text.
   * @param {string} response - Bot's response text.
   * @returns {Promise<void>}
   */
  async onSend(message, response) {
    // 1) append user message
    let prior = this.config.messages;
    let messages = [...prior, { sender: "user", text: message }];

    await storeValue(
      "ChatWidget",
      {
        messages,
        chatId: this.config.chatId,
        agentId: this.config.agentId
      },
      this.config.persist
    );

    this.config.messages = messages;

    // 2) append bot response
    prior = this.config.messages;
    const updated = prior.concat({ sender: "bot", text: response });

    await storeValue(
      "ChatWidget",
      {
        messages: updated,
        chatId: this.config.chatId,
        agentId: this.config.agentId
      },
      this.config.persist
    );

    this.config.messages = updated;
  }
};
