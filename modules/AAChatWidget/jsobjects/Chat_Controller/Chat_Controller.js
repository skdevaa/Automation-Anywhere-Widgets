export default {
  config: {
    baseURL: inputs.baseURL,
    apiKey: inputs.apiKey,
    secret: inputs.secret,
    projectId: inputs.projectId,
		title: inputs.title,
    agentId: "",
    emoji: "no",
    chatName: inputs.chatName,
    chatId: "",
		persist : typeof inputs.persist === 'boolean' ? inputs.persist : /^(?:true|1|yes|y|on)$/i.test((inputs.persist ?? '').toString().trim()),
		textColor : inputs.textColor,
		messages : []
  },

  async onLoad() {
    try {

				let agents = await this.getAgents();
				this.config.agentId = agents[0].code;
				if (this.config.chatId === "") {
					  let response = await AA_CreateChat.run({
						baseURL: this.config.baseURL,
						apiKey: this.config.apiKey,
						secret: this.config.secret,
						projectId: this.config.projectId,
						agentId: this.config.agentId,
						chatName: this.config.chatName,
					});

					this.config.chatId = response?.chat_id || this.config.chatId;
					await storeValue("ChatWidget", {
						messages: [],
						chatId: this.config.chatId,
						agentId: this.config.agentId,
					},this.config.persist);
					this.config.messages = []
				}
			else {
		 		const prior = this.config.messages;
				await storeValue("ChatWidget", {
					messages: prior,
					chatId: this.config.chatId,
					agentId: this.config.agentId,
					},this.config.persist);
			}
				
    } catch (e) {
      // swallow or log
      // console.log("onLoad error:", e);
    }
  },

	async newChat() {					
		const response = await AA_CreateChat.run({
						baseURL: this.config.baseURL,
						apiKey: this.config.apiKey,
						secret: this.config.secret,
						projectId: this.config.projectId,
						agentId: this.config.agentId,
						chatName: this.config.chatName,
					});

	 this.config.chatId = response?.chat_id || this.config.chatId;
	 await storeValue("ChatWidget", {
						messages: [],
						chatId: this.config.chatId,
						agentId: this.config.agentId,
	 },this.config.persist);
		this.config.messages = []
		
	},
		
  async onUpload(message) {
    const prior =this.config.messages;
		let messages = [...prior, { sender: "user", text: message }];
    await storeValue("ChatWidget", {
      messages: messages,
      chatId: this.config.chatId,
			agentId: this.config.agentId,
      },this.config.persist);
		this.config.messages = messages;
  },

  async onSend(message, response) {
    let prior = this.config.messages;
		let messages = [...prior, { sender: "user", text: message }];
    // 1) append user message
    await storeValue("ChatWidget", {
      messages: messages,
      chatId: this.config.chatId,
			agentId: this.config.agentId,
      },this.config.persist);
		this.config.messages = messages;

    // 2) append bot response
		prior = this.config.messages;
    const updated = prior.concat({ sender: "bot", text: response });
    await storeValue("ChatWidget", {
      messages: updated,
      chatId: this.config.chatId,
			agentId: this.config.agentId,
      },this.config.persist);
		this.config.messages = updated;
  },

  async getAgents() {
    // Ensure correct casing of keys passed into your action
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
		this.config.agentId = agentId
		await AA_ActivateAgent.run({ chatId: this.config.chatId, projectId: this.config.projectid , agentId: this.config.agentId, apiKey : this.config.apikey , secret : this.config.secret })
	},

	
};
