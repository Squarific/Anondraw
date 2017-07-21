Anondraw.prototype.createLoginPage = function createLoginPage () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
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
	emailInput.placeholder = "email@example.org";
	
	/* Password field */
	var inputContainer = formContainer.appendChild(document.createElement("div"));
	var password = inputContainer.appendChild(document.createElement("span"));
	password.appendChild(document.createTextNode("Password"));
	var passwordInput = inputContainer.appendChild(document.createElement("input"));
	passwordInput.placeholder = "password";
	passwordInput.type = "password";
	
	/* Login button */
	var loginButton = formContainer.appendChild(document.createElement("div"));
	loginButton.appendChild(document.createTextNode("Log in"));
	loginButton.className = "button login-button";
	
	var loginhelp = formContainer.appendChild(document.createElement("div"));
	loginhelp.className = "loginhelp";
	loginhelp.appendChild(document.createTextNode("Not yet signed up? "));
	var gotosignupbutton = loginhelp.appendChild(document.createElement("a"));
	gotosignupbutton.href = "/register";
	gotosignupbutton.appendChild(document.createTextNode("Create an account"));
	gotosignupbutton.setAttribute("data-navigo", "");
	
	loginhelp.appendChild(document.createElement("br"));
	loginhelp.appendChild(document.createTextNode("Forgot your password? "));
	var gotoforgotbutton = loginhelp.appendChild(document.createElement("a"));
	gotoforgotbutton.href = "/forgot";
	gotoforgotbutton.appendChild(document.createTextNode("Reset it here"));
	gotoforgotbutton.setAttribute("data-navigo", "");
	
	var login = function login () {
		if (accountForm.classList.contains("disabled")) return;
		accountForm.classList.add("disabled");
		
		while (error.firstChild) error.removeChild(error.firstChild);
		
		this.account.login(emailInput.value, passwordInput.value, function (err) {
			if (err) {
				error.appendChild(document.createTextNode(err));
				accountForm.classList.remove("disabled");
				ga("send", "event", "error", "login");
				return;
			}
			
			this.router.navigate("/collab");
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
	emailInput.placeholder = "email@example.org";
	
	/* Password field */
	var inputContainer = formContainer.appendChild(document.createElement("div"));
	var password = inputContainer.appendChild(document.createElement("span"));
	password.appendChild(document.createTextNode("Password"));
	var passwordInput = inputContainer.appendChild(document.createElement("input"));
	passwordInput.type = "password";
	passwordInput.placeholder = "password";
	
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
				ga("send", "event", "error", "register");
				return;
			}
			
			goog_report_register();
			ga("send", "event", "conversion", "register");
			
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

Anondraw.prototype.createForgotPage = function createForgotPage () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	container.appendChild(this.createTopBar());
	
	var accountForm = container.appendChild(document.createElement("div"));
	accountForm.className = "card accountform";
	
	var title = accountForm.appendChild(document.createElement("h1"));
	title.appendChild(document.createTextNode("Forgot password"));
	
	var formContainer = accountForm.appendChild(document.createElement("div"));
	formContainer.className = "form-container";
	
	var error = formContainer.appendChild(document.createElement("div"));
	error.className = "status";
	
	/* Email field */
	var inputContainer = formContainer.appendChild(document.createElement("div"));
	var email = inputContainer.appendChild(document.createElement("span"));
	email.appendChild(document.createTextNode("Email"));
	var emailInput = inputContainer.appendChild(document.createElement("input"));
	emailInput.placeholder = "email@example.org";
	
	/* Forgot button */
	var forgotButton = formContainer.appendChild(document.createElement("div"));
	forgotButton.appendChild(document.createTextNode("Send reset link"));
	forgotButton.className = "button forgot-pw-button";
	
	var forgot = formContainer.appendChild(document.createElement("div"));
	forgot.appendChild(document.createTextNode("We will send you an email with a link. Click it to reset your password."));
	
	var reset = function reset () {
		if (accountForm.classList.contains("disabled")) return;
		accountForm.classList.add("disabled");
		
		while (error.firstChild) error.removeChild(error.firstChild);
		
		this.account.forgot(emailInput.value, function (err) {
			if (err) {
				error.appendChild(document.createTextNode(err));
				accountForm.classList.remove("disabled");
				ga("send", "event", "error", "forgot");
				return;
			}
			
			error.classList.add("no-error");
			error.appendChild(document.createTextNode("An email has been send, you can now click the link inside of it to reset your password."));
			
			accountForm.classList.remove("disabled");
			inputContainer.parentNode.removeChild(inputContainer);
			forgotButton.parentNode.removeChild(forgotButton);
		}.bind(this));
	}.bind(this);
	
	forgotButton.addEventListener("click", reset);
	emailInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) reset();
	});
	
	return container;
};

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}

Anondraw.prototype.createResetPage = function createResetPage () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	container.appendChild(this.createTopBar());
	
	var accountForm = container.appendChild(document.createElement("div"));
	accountForm.className = "card accountform";
	
	var title = accountForm.appendChild(document.createElement("h1"));
	title.appendChild(document.createTextNode("Reset password"));
	
	var formContainer = accountForm.appendChild(document.createElement("div"));
	formContainer.className = "form-container";
	
	var error = formContainer.appendChild(document.createElement("div"));
	error.className = "status";
	
	/* Password field */
	var inputContainer = formContainer.appendChild(document.createElement("div"));
	var password = inputContainer.appendChild(document.createElement("span"));
	password.appendChild(document.createTextNode("New password"));
	var passwordInput = inputContainer.appendChild(document.createElement("input"));
	passwordInput.type = "password";
	passwordInput.placeholder = "password";
	
	/* Reset button */
	var resetButton = formContainer.appendChild(document.createElement("div"));
	resetButton.appendChild(document.createTextNode("Reset password"));
	resetButton.className = "button reset-pw-button";
	
	var reset = function reset () {
		if (accountForm.classList.contains("disabled")) return;
		accountForm.classList.add("disabled");
		
		while (error.firstChild) error.removeChild(error.firstChild);
		
		this.account.reset(getQueryVariable("code"), passwordInput.value, function (err, data) {
			if (err) {
				error.appendChild(document.createTextNode(err));
				accountForm.classList.remove("disabled");
				ga("send", "event", "error", "reset");
				return;
			}
			
			error.classList.add("no-error");
			error.appendChild(document.createTextNode("Your password has been reset for '" + data.email + "' and you have been logged in."));
			
			accountForm.classList.remove("disabled");
			inputContainer.parentNode.removeChild(inputContainer);
			resetButton.parentNode.removeChild(resetButton);
		}.bind(this));
	}.bind(this);
	
	resetButton.addEventListener("click", reset);
	passwordInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) reset();
	});
	
	return container;
};