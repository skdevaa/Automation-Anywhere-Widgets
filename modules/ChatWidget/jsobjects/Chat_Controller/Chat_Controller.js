export default {
  // Internal runtime config; will be hydrated from inputs lazily.
  config: {
    baseURL: "",
    apiKey: "",
    secret: "",
    projectId: "",
    title: "AI Assistant",
    agentId: "",
    emoji: "no",
    chatName: "",
    chatId: "",
    persist: false,
    textColor: "black",
    messages: [],
  },

  // --- helpers ----------------------------------------------------------

  getSafeInputs() {
    // "inputs" is injected by Appsmith for modules; guard in case it's not ready
    try {
      if (typeof inputs === "object" && inputs) return inputs;
    } catch (e) {
      // swallow; we'll fall back to existing config
    }
    return {};
  },

  syncConfigFromInputs() {
    const i = this.getSafeInputs();

    // Only override when we actually have a value
    const parsedPersist =
      typeof i.persist === "boolean"
        ? i.persist
        : /^(?:true|1|yes|y|on)$/i.test(
            (i.persist ?? this.config.persist ?? "false").toString().trim()
          );

    this.config = {
      ...this.config,
      baseURL: i.baseURL ?? this.config.baseURL ?? "",
      apiKey: i.apiKey ?? this.config.apiKey ?? "",
      secret: i.secret ?? this.config.secret ?? "",
      projectId: i.projectId ?? this.config.projectId ?? "",
      title: i.title ?? this.config.title ?? "AI Assistant",
      chatName: i.chatName ?? this.config.chatName ?? "",
      textColor: i.textColor ?? this.config.textColor ?? "black",
      persist: parsedPersist,
      // keep existing chatId/agentId/messages if already set
      chatId: this.config.chatId ?? "",
      agentId: this.config.agentId ?? "",
      messages: this.config.messages || [],
      emoji: this.config.emoji ?? "no",
    };
  },

  // --- lifecycle --------------------------------------------------------

  async onLoad() {
    try {
      this.syncConfigFromInputs();

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
          this.config.persist,
        );

        this.config.messages = [];
      } else {
        const prior = this.config.messages || [];
        await storeValue(
          "ChatWidget",
          {
            messages: prior,
            chatId: this.config.chatId,
            agentId: this.config.agentId,
          },
          this.config.persist,
        );
      }
    } catch (e) {
      // optionally log: console.log("Chat onLoad error", e);
    }
  },

  // --- chat actions -----------------------------------------------------

  async newChat() {
    this.syncConfigFromInputs();

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
      this.config.persist,
    );
  },

  async onUpload(message) {
    this.syncConfigFromInputs();

    const prior = this.config.messages || [];
    const messages = [...prior, { sender: "user", text: message }];

    await storeValue(
      "ChatWidget",
      {
        messages,
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist,
    );

    this.config.messages = messages;
  },

  async onSend(message, response) {
    this.syncConfigFromInputs();

    // user message
    const prior = this.config.messages || [];
    const messages = [...prior, { sender: "user", text: message }];

    await storeValue(
      "ChatWidget",
      {
        messages,
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist,
    );

    this.config.messages = messages;

    // bot message
    const updated = [...this.config.messages, { sender: "bot", text: response }];

    await storeValue(
      "ChatWidget",
      {
        messages: updated,
        chatId: this.config.chatId,
        agentId: this.config.agentId,
      },
      this.config.persist,
    );

    this.config.messages = updated;
  },

  // --- APIs -------------------------------------------------------------

  async getAgents() {
    this.syncConfigFromInputs();

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
    this.syncConfigFromInputs();

    this.config.agentId = agentId;

    await AA_ActivateAgent.run({
      chatId: this.config.chatId,
      projectId: this.config.projectId,
      agentId: this.config.agentId,
      apiKey: this.config.apiKey,
      secret: this.config.secret,
    });
  },
};
