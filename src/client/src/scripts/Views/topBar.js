Anondraw.prototype.createTopBar = function createTopBar () {
	/*
		Top bar
	*/
	
	var topBar = document.createElement("div");
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("a"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	logo.href = "/";
	logo.setAttribute("data-navigo", "");
	
	var registerButton = topBar.appendChild(document.createElement("a"));
	registerButton.className = "button signup";
	registerButton.href = "/register";
	registerButton.appendChild(document.createTextNode("Sign up"));
	registerButton.setAttribute("data-navigo", "");
	
	var loginButton = topBar.appendChild(document.createElement("a"));
	loginButton.className = "button login";
	loginButton.href = "/login";
	loginButton.appendChild(document.createTextNode("Log in"));
	loginButton.setAttribute("data-navigo", "");
	
	var clear = topBar.appendChild(document.createElement("div"));
	clear.style.clear = "both";
	
	this.account.isLoggedIn(function (err, isLoggedIn) {
		if (isLoggedIn) {
			registerButton.parentNode.removeChild(registerButton);
			loginButton.parentNode.removeChild(loginButton);
			clear.parentNode.removeChild(clear);
			
			var collabButton = topBar.appendChild(document.createElement("a"));
			collabButton.className = "button signup";
			collabButton.href = "/collab";
			collabButton.appendChild(document.createTextNode("Open Collab App"));
			collabButton.setAttribute("data-navigo", "");
			
			this.router.updatePageLinks();
			var clear = topBar.appendChild(document.createElement("div")).style.clear = "both";
		}
	}.bind(this));
	
	return topBar;
};