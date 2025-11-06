export default {
	
	config: {},
	
  // Build config from inputs every time
  buildConfig() {
    return {
      baseURL: inputs.baseURL,
      apiKey: inputs.apiKey,
      secret: inputs.secret,
      title: inputs.title,
      projectId: inputs.projectId,
      agentId: "",
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
      messages: [],
    };
  },

  async onLoad() {
    // initialize local config snapshot for this instance
    this.config = this.buildConfig();

    // guard: if critical inputs are missing on first render, bail quietly
    if (!this.config.projectId || !this.config.apiKey || !this.config.secret) {
      return;
    }

    try {
      const agents = await this.getAgents();
      if (!agents?.length) return;

      this.config.agentId = agents[0].code;
      await this.setAgentId(this.config.agentId);

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
            messages: this.config.messages,
            chatId: this.config.chatId,
            agentId: this.config.agentId,
          },
          this.config.persist
        );
      }
    } catch (e) {
      // optional: log
    }
  },

  async getAgents() {
    const { projectId, apiKey, secret } = this.config || {};
    if (!projectId || !apiKey || !secret) return [];

    const response = await AA_GetAgents.run({
      projectId,
      apiKey,
      secret,
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
    this.config.agentId = agentId;

    const { chatId, projectId, apiKey, secret } = this.config || {};
    if (!projectId || !apiKey || !secret) return;

    await AA_ActivateAgent.run({
      chatId,
      projectId,
      agentId: this.config.agentId,
      apiKey,
      secret,
    });
  },

};
