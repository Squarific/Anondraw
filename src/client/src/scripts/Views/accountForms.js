Anondraw.prototype.createLoginPage = function createLoginPage () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("span"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	
	var accountForm = container.appendChild(document.createElement("div"));
	accountForm.className = "card accountform";
	
	var formContainer = accountForm.appendChild(document.createElement("div"));
	formContainer.className = "form-container";
	
	/* Email field */
	var inputContainer = formContainer.appendChild(document.createElement("div"));
	var email = inputContainer.appendChild(document.createElement("span"));
	email.appendChild(document.createTextNode("Email"));
	var emailInput = inputContainer.appendChild(document.createElement("input"));
	
	/* Password field */
	var inputContainer = formContainer.appendChild(document.createElement("div"));
	var password = inputContainer.appendChild(document.createElement("span"));
	password.appendChild(document.createTextNode("Password"));
	var passwordInput = inputContainer.appendChild(document.createElement("input"));
	passwordInput.type = "password";
	
	/* Login button */
	var loginButton = formContainer.appendChild(document.createElement("div"));
	loginButton.appendChild(document.createTextNode("Login"));
	loginButton.className = "button login-button";
	
	return container;
};

Anondraw.prototype.createRegisterPage = function createRegisterPage () {
	var container = document.createElement("div");
	container.className = "card";
	
	
	
	return container;
};

Anondraw.prototype.createLogoutPage = function createLogoutPage () {
	var container = document.createElement("div");
	container.className = "card";
	
	
	
	return container;
};