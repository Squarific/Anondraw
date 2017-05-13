Anondraw.prototype.createLoginPage = function createLoginPage () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("a"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	logo.href = "/";
	logo.setAttribute("data-navigo", "");
	
	var accountForm = container.appendChild(document.createElement("div"));
	accountForm.className = "card accountform";
	
	var title = accountForm.appendChild(document.createElement("h1"));
	title.appendChild(document.createTextNode("Log in"));
	
	var formContainer = accountForm.appendChild(document.createElement("div"));
	formContainer.className = "form-container";
	
	var error = formContainer.appendChild(document.createElement("div"));
	error.className = "status";
	
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
	loginButton.appendChild(document.createTextNode("Log in"));
	loginButton.className = "button login-button";
	
	var signup = formContainer.appendChild(document.createElement("div"));
	signup.appendChild(document.createTextNode("Not yet signed up? "));
	var gotosignupbutton = signup.appendChild(document.createElement("a"));
	gotosignupbutton.href = "/register";
	gotosignupbutton.appendChild(document.createTextNode("Click here to create an account"));
	gotosignupbutton.setAttribute("data-navigo", "");
	
	var login = function login () {
		if (accountForm.classList.contains("disabled")) return;
		accountForm.classList.add("disabled");
		
		while (error.firstChild) error.removeChild(error.firstChild);
		
		this.account.login(emailInput.value, passwordInput.value, function (err) {
			if (err) {
				error.appendChild(document.createTextNode(err));
				accountForm.classList.remove("disabled");
				return;
			}
			
			this.router.navigate("/");
		}.bind(this));
	}.bind(this);
	
	loginButton.addEventListener("click", login);
	emailInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) login();
	});
	passwordInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) login();
	});
	
	
	return container;
};

Anondraw.prototype.createRegisterPage = function createRegisterPage () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("a"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	logo.href = "/";
	logo.setAttribute("data-navigo", "");
	
	var accountForm = container.appendChild(document.createElement("div"));
	accountForm.className = "card accountform";
	
	var title = accountForm.appendChild(document.createElement("h1"));
	title.appendChild(document.createTextNode("Sign up"));
	
	var formContainer = accountForm.appendChild(document.createElement("div"));
	formContainer.className = "form-container";
	
	var error = formContainer.appendChild(document.createElement("div"));
	error.className = "status";
	
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
	
	/* Register button */
	var registerButton = formContainer.appendChild(document.createElement("div"));
	registerButton.appendChild(document.createTextNode("Sign up"));
	registerButton.className = "button register-button";
	
	var register = function register () {
		if (accountForm.classList.contains("disabled")) return;
		accountForm.classList.add("disabled");
		
		while (error.firstChild) error.removeChild(error.firstChild);
		
		this.account.register(emailInput.value, passwordInput.value, function (err) {
			if (err) {
				error.appendChild(document.createTextNode(err));
				accountForm.classList.remove("disabled");
				return;
			}
			
			this.router.navigate("/new");
		}.bind(this));
	}.bind(this);
	
	registerButton.addEventListener("click", register);
	emailInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) register();
	});
	passwordInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) register();
	});
	
	return container;
};

Anondraw.prototype.createLogoutPage = function createLogoutPage () {
	var container = document.createElement("div");
	container.className = "card";
	
	/*
		Top bar
	*/
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("a"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	logo.href = "/";
	logo.setAttribute("data-navigo", "");
	
	var accountForm = container.appendChild(document.createElement("div"));
	accountForm.className = "card accountform";
	accountForm.style.cursor = "wait";
	
	var statusText = accountForm.appendChild(document.createElement("span"));
	statusText.appendChild(document.createTextNode("We are logging you out, please be patient ..."));
	
	this.account.logout(function (err, loggedOut) {
		accountForm.style.cursor = "";
		
		while (statusText.firstChild)
			statusText.removeChild(statusText.firstChild);
		
		if (err) {
			statusText.appendChild(document.createTextNode(err));
			statusText.classList.add("error");
			return;
		}
		
		statusText.appendChild(document.createTextNode("You have been successfully logged out!"));
	});
	
	return container;
};