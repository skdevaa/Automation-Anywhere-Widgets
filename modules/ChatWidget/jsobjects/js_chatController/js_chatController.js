export default {
	/**
   * Global configuration for the chat widget and backend connectivity.
   *
   * @property {string} baseURL - Base URL of the backend/chat API.
   * @property {string} apiKey - API key for authenticating requests.
   * @property {string} secret - Secret/token for additional authentication.
   * @property {string} title - Widget title / header text.
   * @property {string} projectId - Project identifier used by the backend.
   * @property {string} agentId - Currently active agent ID (selected or activated).
   * @property {("yes"|"no")} emoji - Flag controlling emoji support in the UI.
   * @property {string} chatName - Name/label of the chat session.
   * @property {string} chatId - Current chat session ID.
   * @property {boolean} persist - Whether to persist state via `storeValue`.
   * @property {string} textColor - Text color for the widget UI.
	 * @property {string} textColor - Message color for the widget UI.
   * @property {Array<{sender: "user"|"bot", text: string}>} messages - In-memory message history.
   */
	
	config: {
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
		messageColor: inputs.messageColor,
		messages: []
	},

	/**
   * Lifecycle hook to initialize the chat widget when it loads.
   *
   * Behavior:
   * - Fetches the list of agents.
   * - Sets the first agent as the active `agentId` (if available).
   * - If no `chatId` exists, creates a new chat session via `AA_CreateChat`.
   * - Persists/initializes chat state in `storeValue("ChatWidget", ...)`.
   *
   * Errors are caught and swallowed (optionally log in your environment).
   *
   * @returns {Promise<void>}
   */
	async onLoad() {
		try {
			this.config.agentId = "";
			const agents = await this.getAgents();
			this.config.agentId = agents[0]?.code || this.config.agentId;

			agents.setOptions(agents)

			if (this.config.chatId === "") {
				const response = await qry_createChat.run({
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
		}
		catch {
			console.log("Chat Config",this.config)
		}
	}, 

	/**
   * Start a new chat session.
   *
   * - Calls `AA_CreateChat` to create a new chat.
   * - Updates `chatId` with the new ID if returned.
   * - Clears in-memory messages.
   * - Persists the cleared state for the widget.
   *
   * @returns {Promise<void>}
   */
	async newChat() {
		const response = await qry_createChat.run({
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
   * - Appends a new user message to the local history.
   * - Persists the updated history and metadata.
   *
   * @param {string} message - Content of the user message (e.g., upload info/text).
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
   * Handle a standard send interaction.
   *
   * Flow:
   * 1. Append the user message to history.
   * 2. Persist the updated history.
   * 3. Append the bot response.
   * 4. Persist the final updated history.
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
	},

	/**
   * Fetch the list of available agents from the backend.
   *
   * - Calls `AA_GetAgents` with project credentials.
   * - Normalizes the response into an array.
   * - Maps each agent into `{ code, name }`.
   *
   * @returns {Promise<Array<{code: string, name: string}>>} List of agents.
   */
	async getAgents() {
		const response = await qry_getAgents.run({
			projectId: this.config.projectId,
			apiKey: this.config.apiKey,
			secret: this.config.secret
		});

		const list = Array.isArray(response?.agents)
		? response.agents
		: Object.values(response?.agents || {});

		return list.map(agent => ({
			code: agent.id,
			name: agent.name
		}));
	},

	/**
   * Set the active agent ID for the current chat and notify backend.
   *
   * - Updates `config.agentId`.
   * - Calls `AA_ActivateAgent` to activate the agent for the current chat.
   *
   * @param {string} agentId - ID of the agent to activate.
   * @returns {Promise<void>}
   */
	async setAgentId(agentId) {
		this.config.agentId = agentId;

		await qry_ActivateAgent.run({
			chatId: this.config.chatId,
			projectId: this.config.projectid, // Note: ensure field name matches your backend expectations
			agentId: this.config.agentId,
			apiKey: this.config.apikey,
			secret: this.config.secret
		});
	}
};
