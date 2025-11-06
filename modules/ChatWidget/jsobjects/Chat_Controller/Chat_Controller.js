export default {
  // Single source of truth used by all actions + APIs
  config: {
    baseURL: "",
    apiKey: "",
    secret: "",
    title: "",
    projectId: "",
    agentId: "",
    emoji: "no",
    chatName: "",
    chatId: "",
    persist: false,
    textColor: "black",
    messages: [],
  },

  // ---- internal: keep config in sync with module inputs ----
  syncFromInputs() {
    let i = {};
    try {
      if (typeof inputs === "object" && inputs) {
        i = inputs;
      }
    } catch (e) {
      // inputs not ready yet; leave i as {}
    }

    // Only overwrite when there's something to use
    this.config.baseURL = i.baseURL || this.config.baseURL || "";
    this.config.apiKey = i.apiKey || this.config.apiKey || "";
    this.config.secret = i.secret || this.config.secret || "";
    this.config.projectId = i.projectId || this.config.projectId || "";
    this.config.title = i.title || this.config.title || "AI Assistant";
    this.config.chatName = i.chatName || this.config.chatName || "Appsmith";
    this.config.textColor = i.textColor || this.config.textColor || "black";

    if (typeof i.persist === "boolean") {
      this.config.persist = i.persist;
    } else if (i.persist != null) {
      this.config.persist = /^(?:true|1|yes|y|on)$/i.test(
        String(i.persist).trim()
      );
    }
  },

  // ---- lifecycle -------------------------------------------------------

  async onLoad() {
    this.syncFromInputs();

    // If we still don't have required creds, do nothing (prevents errors)
    if (!this.config.baseURL || !this.config.apiKey || !this.config.secret || !this.config.projectId) {
      return;
    }

    try {
      const agents = await this.getAgents();
      if (agents?.length) {
        this.config.agentId = agents[0].code;
        await this.setAgentId(this.config.agentId);
      }

      if (!this.config.chatId) {
        const response = await AA_CreateChat.run({
          baseURL: this.config.baseURL,
          apiKey: this.config.apiKey,
          secret: this.config.secret,
          projectId: this.config.projectId,
          agentId: this.config.agentId,
          chatName: this.config.chatName,
        });

        this.config.chatId = response?.chat_id || this.config.chatId;

        await storeValue(
          "ChatWidget",
          {
            messages: [],
            chatId: this.config.chatId,
            agentId: this.config.agentId,
          },
          this.config.persist
        );

        this.config.messages = [];
      } else {
        await storeValue(
          "ChatWidget",
          {
            messages: this.config.messages || [],
            chatId: this.config.chatId,
            agentId: this.config.agentId,
          },
          this.config.persist
        );
      }
    } catch (e) {
      // swallow / log as needed
    }
  },

  // ---- chat helpers ----------------------------------------------------

  async newChat() {
    this.syncFromInputs();

    const response = await AA_CreateChat.run({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      secret: this.config.secret,
      projectId: this.config.projectId,
      agentId: this.config.agentId,
      chatName: this.config.chatName,
    });

    this.config.chatId = response?.chat_id || this.config.chatId;
    this.config.messages = [];

    await storeValue(
      "ChatWidget",
      {
        messages: [],
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist
    );
  },

  async onUpload(message) {
    this.syncFromInputs();

    const prior = this.config.messages || [];
    const messages = [...prior, { sender: "user", text: message }];

    await storeValue(
      "ChatWidget",
      {
        messages,
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist
    );

    this.config.messages = messages;
  },

  async onSend(message, response) {
    this.syncFromInputs();

    // append user
    const prior = this.config.messages || [];
    const messages = [...prior, { sender: "user", text: message }];

    await storeValue(
      "ChatWidget",
      {
        messages,
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist
    );

    this.config.messages = messages;

    // append bot
    const updated = [...this.config.messages, { sender: "bot", text: response }];

    await storeValue(
      "ChatWidget",
      {
        messages: updated,
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist
    );

    this.config.messages = updated;
  },

  // ---- backend calls ---------------------------------------------------

  async getAgents() {
    this.syncFromInputs();

    if (!this.config.projectId || !this.config.apiKey || !this.config.secret) {
      return [];
    }

    const response = await AA_GetAgents.run({
      projectId: this.config.projectId,
      apiKey: this.config.apiKey,
      secret: this.config.secret,
    });

    const list = Array.isArray(response?.agents)
      ? response.agents
      : Object.values(response?.agents || {});

    return list.map((agent) => ({
      code: agent.id,
      name: agent.name,
    }));
  },

  async setAgentId(agentId) {
    this.syncFromInputs();

    this.config.agentId = agentId;

    if (!this.config.chatId || !this.config.projectId) return;

    await AA_ActivateAgent.run({
      chatId: this.config.chatId,
      projectId: this.config.projectId, // <-- correct key
      agentId: this.config.agentId,
      apiKey: this.config.apiKey,       // <-- correct key
      secret: this.config.secret,
    });
  },
};
