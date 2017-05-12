Anondraw.prototype.createHome = function createHome () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("span"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	
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
	
	/*
		Header image
	*/
	
	var headerImage = container.appendChild(document.createElement("img"));
	headerImage.src = "images/header.png";
	headerImage.alt = "Header image, examples of drawings";
	headerImage.className = "headerImage";
	
	/*
		Collaboration feature
	*/
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
	
	/*
		Socialize feature
	*/
	var feature = container.appendChild(document.createElement("div"));
	feature.className = "feature-container";
	
	var img = feature.appendChild(document.createElement("img"));
	img.className = "feature-image";
	img.src = "images/features/social.png";
	
	var div = feature.appendChild(document.createElement("div"));
	div.className = "feature-text-container";
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("Socialize and share"));
	
	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("We make it possible for you to share your art and status updates with your network. Upload your own drawings or share it directly from the collaboration tool."));
	
	var tryButton = div.appendChild(document.createElement("a"));
	tryButton.className = "button trybutton";
	tryButton.appendChild(document.createTextNode("Sign up to start"));
	tryButton.href = "/register";
	tryButton.setAttribute("data-navigo", "");
	
	/*
		Socialize feature
	*/
	var feature = container.appendChild(document.createElement("div"));
	feature.className = "feature-container";
	
	var img = feature.appendChild(document.createElement("img"));
	img.className = "feature-image";
	img.src = "images/features/profile.png";
	
	var div = feature.appendChild(document.createElement("div"));
	div.className = "feature-text-container";
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("Portfolio"));
	
	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("It was never this easy to create a breathtaking portfolio. You'll be able to show everyone exactly how good of an artist you are. Build it up slowely over time and you'll be amazed at what you can achieve."));
	
	var tryButton = div.appendChild(document.createElement("a"));
	tryButton.className = "button trybutton";
	tryButton.appendChild(document.createTextNode("Check out a random profile"));
	tryButton.href = "/register";
	tryButton.setAttribute("data-navigo", "");
	
	return container;
};