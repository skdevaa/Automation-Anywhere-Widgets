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

				if (this.config.chatId === "") {
					  let response = await qry_createChat.run();
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

	
	
};
