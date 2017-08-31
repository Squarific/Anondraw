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
	adContainer.className = "adcontainer";

	var ad = '<!-- Project Wonderful Ad Box Code -->' +
	         '<div style="text-align:center;"><div style="display:inline-block;" id="pw_adbox_78949_1_0"></div></div>' +
	         '<script type="text/javascript"></script>' +
	         '<noscript><div style="text-align:center;"><div style="display:inline-block;"><map name="admap78949" id="admap78949"><area href="http://www.projectwonderful.com/out_nojs.php?r=0&c=0&id=78949&type=1" shape="rect" coords="0,0,468,60" title="" alt="" target="_blank" /></map>' +
	         '<table cellpadding="0" cellspacing="0" style="width:468px;border-style:none;background-color:#eef2f5;"><tr><td><img src="http://www.projectwonderful.com/nojs.php?id=78949&type=1" style="width:468px;height:60px;border-style:none;" usemap="#admap78949" alt="" /></td></tr><tr><td style="background-color:#eef2f5;" colspan="1"><center><a style="font-size:10px;color:#364350;text-decoration:none;line-height:1.2;font-weight:bold;font-family:Tahoma, verdana,arial,helvetica,sans-serif;text-transform: none;letter-spacing:normal;text-shadow:none;white-space:normal;word-spacing:normal;" href="http://www.projectwonderful.com/advertisehere.php?id=78949&type=1" target="_blank">Ads by Project Wonderful!  Your ad here, right now: $0</a></center></td></tr></table></div></div>' +
	         '</noscript>' +
	         '<!-- End Project Wonderful Ad Box Code -->';
	adContainer.innerHTML = ad;
	
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
	
	var profiles = [1, 15981, 16684, 18070, 17603, 12575, 5866, 87, 14344, 18145, 16973, 7833, 3753, 11290, 18041, 4734, 5036, 17988, 15503, 17966, 12238, 17901, 17940];
	var tryButton = div.appendChild(document.createElement("a"));
	tryButton.className = "button trybutton";
	tryButton.appendChild(document.createTextNode("Check out a random profile"));
	tryButton.href = "/profile/" + profiles[Math.floor(Math.random() * profiles.length)];
	tryButton.setAttribute("data-navigo", "");
	
	return container;
};