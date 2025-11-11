export default {
	
	validUser : false,
	token : null,
	
	
	async getToken() {
		let response = await qry_authenticatePwd.run()
		return  response.token
  },
	
	async check_user() {
		try {
			this.token = await this.getToken();
			this.validUser  =  this.token != "" ;
			if (this.validUser) {
				navigateTo(inputs.nextPage)
			}
			else {
				showAlert("No valid credentials")
			}
		}
		catch {
				showAlert("No valid credentials")
		}
	}
	
}