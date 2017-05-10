Anondraw.prototype.createHome = function createHome () {
	var container = document.createElement("div");
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("span"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	
	var registerButton = topBar.appendChild(document.createElement("a"));
	registerButton.className = "button signup";
	registerButton.href = "/register";
	registerButton.appendChild(document.createTextNode("Sign up"));
	
	var loginButton = topBar.appendChild(document.createElement("a"));
	loginButton.className = "button login";
	loginButton.href = "/login";
	loginButton.appendChild(document.createTextNode("Log in"));
	
	var headerImage = container.appendChild(document.createElement("img"));
	headerImage.src = "images/header.png";
	headerImage.alt = "Header image, examples of drawings";
	headerImage.className = "headerImage";
	
	var feature = container.appendChild(document.createElement("div"));
	feature.className = "feature-container";
	
	
	var img = feature.appendChild(document.createElement("img"));
	img.className = "feature-image";
	img.src = "images/features/collaborate.png";
	
	var div = feature.appendChild(document.createElement("div"));
	div.className = "feature-text-container";
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("Collaboration without limits"));
	
	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("Our tools enable you to create stunning imagery together. Claim your spot on an infinite public canvas or create a private room for you and your team."));
	
	var tryButton = div.appendChild(document.createElement("a"));
	tryButton.className = "button trybutton";
	tryButton.appendChild(document.createTextNode("Try it out, no registration required"));
	tryButton.href = "/collab";
	tryButton.setAttribute("data-navigo", "");
	
	return container;
};