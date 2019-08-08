Anondraw.prototype.createHome = function createHome () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
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
		In between features ad
	*/
	
	var adContainer = container.appendChild(document.createElement("div"));
	
	var ad = adContainer.appendChild(document.createElement("div"));
	ad.id = "amzn-assoc-ad-123acff2-6857-4569-a250-fd703f6a941d";
	
	var script = adContainer.appendChild(document.createElement("script"));
	script.src = "//z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US&adInstanceId=123acff2-6857-4569-a250-fd703f6a941d";
	script.onload = function () {
		setTimeout(function () {
			adContainer.className = "adcontainer";
		}, 950);
		
		setTimeout(function () {
			ad.id = "";
		}, 1250);
	};
	
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
	p.appendChild(document.createTextNode("It was never this easy to create a breathtaking portfolio. You'll be able to show everyone exactly how good of an artist you are. Build it up slowly over time and you'll be amazed at what you can achieve."));
	
	var profiles = [1, 15981, 16684, 18070, 17603, 12575, 5866, 87, 14344, 18145, 16973, 7833, 3753, 11290, 18041, 4734, 5036, 17988, 15503, 17966, 12238, 17901, 17940, 25918];
	var tryButton = div.appendChild(document.createElement("a"));
	tryButton.className = "button trybutton";
	tryButton.appendChild(document.createTextNode("Check out a random profile"));
	tryButton.href = "/profile/" + profiles[Math.floor(Math.random() * profiles.length)];
	tryButton.setAttribute("data-navigo", "");
	
	return container;
};
