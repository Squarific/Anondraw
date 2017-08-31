Anondraw.prototype.createProfilePage = function createProfilePage (userid) {
	var container = document.createElement("div");
	container.className = "profilecontainer";
	
	container.appendChild(this.createTopBar());
	
	var content = container.appendChild(document.createElement("div"));
	content.className = "profile";
	
	this.createProfile(userid, content);
	
	return container;
};

/*
	Gets the profile data
*/
Anondraw.prototype.createProfile = function createProfile (userid, content) {
	this.account.getProfileData(userid, function (err, data) {
		if (err || data.error || data.err) {
			content.appendChild(document.createTextNode(err || data.error || data.err));
			content.classList.add("error");
			return;
		}
		
		data.profile.id = userid;
		this.createProfileWithData(data.profile, content);
	}.bind(this));
};

/*
	Setup the profile dom with the profile data
*/
Anondraw.prototype.createProfileWithData = function createProfileWithData (data, container) {
	this.createProfileHeaderImage(data, container);
	this.createProfilePicture(data, container);
	
	var contentContainer = container.appendChild(document.createElement("div"));
	contentContainer.className = "contentcontainer";
	
	this.createProfileColumn(data, contentContainer);
	this.createProfileFeed(data, contentContainer);
};

Anondraw.prototype.createProfileHeaderImage = function createProfileHeaderImage (data, container) {
	var img = container.appendChild(document.createElement("img"));
	
	if (!data.headerImage) {
		img.src = "images/profile/header.png";
	} else {
		img.src = "http://anondraw.com/userimages/" + data.headerImage + ".png";
	}
	
	img.alt = data.last_username + " header";
	img.className = "header";
};

Anondraw.prototype.createProfilePicture = function createProfilePicture (data, container) {
	var profilePicContainer = container.appendChild(document.createElement("div"));
	profilePicContainer.className = "profilepiccontainer";
	
	if (this.account.id == data.id) {
		this.createProfileEditButton(data, profilePicContainer);
	}
	
	var img = profilePicContainer.appendChild(document.createElement("img"));
	
	if (!data.profileImage) {
		img.src = "images/profile/profile.png";
	} else {
		img.src = "http://anondraw.com/userimages/" + data.profileImage + ".png";
	}
	
	img.alt = data.last_username + " profile picture";
	img.className = "profilepic";
	
	var username = profilePicContainer.appendChild(document.createElement("h1"));
	username.appendChild(document.createTextNode(data.last_username));
};

Anondraw.prototype.createProfileEditButton = function createProfileEditButton (data, container) {
	var edit = container.appendChild(document.createElement("span"));
	edit.className = "edit fa fa-pencil";
	edit.addEventListener("click", this.openProfileEditWindow.bind(this, data));
};

Anondraw.prototype.openProfileEditWindow = function openProfileEditWindow (data) {
	var editWindow = this.gui.createWindow({ title: "Edit profile"});
	var content = editWindow.appendChild(document.createElement("div"));
	content.className = "content editwindow";
	
	this.createProfilePictureInput(content);
	this.createProfileHeaderInput(content);
	this.createProfileBioInput(data, content);
};

Anondraw.prototype.createProfileBioInput = function createProfileBioInput (data, content) {
	var title = content.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Change profile bio"));
	
	var status = content.appendChild(document.createElement("span"));
	status.className = "status";
	
	var textarea = content.appendChild(document.createElement("textarea"));
	textarea.value = data.bio;
	
	var a = content.appendChild(document.createElement("div"));
	a.className = "button";
	a.appendChild(document.createTextNode("Update"));
	a.addEventListener("click", function () {
		status.classList.add("disabled");
		while (status.firstChild) status.removeChild(status.firstChild);
		status.classList.remove("error");

		this.account.setBio(textarea.value, function (err, data) {
			status.classList.remove("disabled");
			
			if (err || data.err || data.error) {
				status.appendChild(document.createTextNode(err || data.err || data.error));	
				status.classList.add("error");
			} else {
				status.appendChild(document.createTextNode("Bio updated!"));
				// Force the page to refresh
				this.router.navigate("/home");
				this.router.navigate("/profile");
			}
		}.bind(this));
	}.bind(this));
};

Anondraw.prototype.createProfilePictureInput = function createProfilePictureInput (content) {
	var title = content.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Change profile picture (best ratio: 1:1)"));
	
	var status = content.appendChild(document.createElement("span"));
	status.className = "status";
	
	var input = content.appendChild(document.createElement("input"));
	input.type = "file";
	
	var a = content.appendChild(document.createElement("div"));
	a.className = "button";
	a.appendChild(document.createTextNode("Upload"));
	
	
	a.addEventListener("click", function () {
		status.classList.add("disabled");
		while (status.firstChild) status.removeChild(status.firstChild);
		status.classList.remove("error");
		
		if (!input.files[0]) {
			status.classList.remove("disabled");
			status.appendChild(document.createTextNode("Please select an image first."));
			status.classList.add("error");
			return;
		}
		
		var reader = new FileReader();
		reader.addEventListener("load", function () {
			console.log(reader.result);
			this.account.sharePicture(reader.result, "New profile picture.", "profile", function (err, data) {
				status.classList.remove("disabled");
				if (err || data.err || data.error) {
					status.appendChild(document.createTextNode(err || data.err || data.error));	
					status.classList.add("error");
					return;
				}
				
				status.appendChild(document.createTextNode("Profile picture updated!"));
				
				// Force the page to refresh
				this.router.navigate("/home");
				this.router.navigate("/profile");
			}.bind(this));
		}.bind(this));
		reader.readAsDataURL(input.files[0]);
	}.bind(this));
};

Anondraw.prototype.createProfileHeaderInput = function createProfileHeaderInput (content) {
	var title = content.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Change profile header (best ratio: 4:1)"));
	
	var status = content.appendChild(document.createElement("span"));
	status.className = "status";
	
	var input = content.appendChild(document.createElement("input"));
	input.type = "file";
	
	var a = content.appendChild(document.createElement("div"));
	a.className = "button";
	a.appendChild(document.createTextNode("Upload"));
	a.addEventListener("click", function () {
		status.classList.add("disabled");
		while (status.firstChild) status.removeChild(status.firstChild);
		status.classList.remove("error");
		
		if (!input.files[0]) {
			status.classList.remove("disabled");
			status.appendChild(document.createTextNode("Please select an image first."));
			status.classList.add("error");
			return;
		}
		
		var reader = new FileReader();
		reader.addEventListener("load", function () {
			this.account.sharePicture(reader.result, "New header image.", "header", function (err, data) {
				status.classList.remove("disabled");
				if (err || data.err || data.error) {
					status.appendChild(document.createTextNode(err || data.err || data.error));	
					status.classList.add("error");
					return;
				}
				
				status.appendChild(document.createTextNode("Header image updated!"));
				
				// Force the page to refresh
				this.router.navigate("/home");
				this.router.navigate("/profile");
			}.bind(this));
		}.bind(this));
		reader.readAsDataURL(input.files[0]);
	}.bind(this));
};

Anondraw.prototype.createProfileColumn = function createProfileColumn (data, container) {
	var column = container.appendChild(document.createElement("div"));
	column.className = "column";
	
	this.createProfileBio(data, column);
	this.createSendMessage(data, column);
	this.createGeneralInfo(data, column);
};

Anondraw.prototype.createSendMessage = function createSendMessage (data, container) {
	var a = container.appendChild(document.createElement("a"));
	a.className = "button sendmessage";
	a.appendChild(document.createTextNode("Send Message"));
	a.href = "messages/" + data.id + "/" + data.last_username;
	a.setAttribute("data-navigo", "");
	
	this.router.updatePageLinks();
};

Anondraw.prototype.createGeneralInfo = function createGeneralInfo (data, container) {
	var bio = container.appendChild(document.createElement("div"));
	bio.className = "bio";

	var h2 = bio.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("General Info"));
	
	var h3 = bio.appendChild(document.createElement("h3"));
	h3.appendChild(document.createTextNode("Reputation"));
	
	var reputation = bio.appendChild(document.createElement("span"));
	reputation.appendChild(document.createTextNode(data.reputation));
	
	var h3 = bio.appendChild(document.createElement("h3"));
	h3.appendChild(document.createTextNode("Last Online"));
	
	var lastonline = bio.appendChild(document.createElement("span"));
	lastonline.appendChild(document.createTextNode((new Date(data.last_online)).toLocaleString()));
	
	var h3 = bio.appendChild(document.createElement("h3"));
	h3.appendChild(document.createTextNode("Registered"));
	
	var registered = bio.appendChild(document.createElement("span"));
	if (!data.registered) registered.appendChild(document.createTextNode("Since the beginning of time"));
	else registered.appendChild(document.createTextNode((new Date(data.registered)).toLocaleString()));
};

Anondraw.prototype.createProfileBio = function createProfileBio (data, container) {
	var bio = container.appendChild(document.createElement("div"));
	bio.className = "bio";
	
	var h2 = bio.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("Bio"));
	
	var splitBio = data.bio.split("\n");
	for (var k = 0; k < splitBio.length; k++) {
		bio.appendChild(document.createTextNode(splitBio[k]));
		bio.appendChild(document.createElement("br"));
	}
};

Anondraw.prototype.createProfileFeed = function createProfileFeed (data, container) {
	var feed = container.appendChild(document.createElement("div"));
	feed.className = "feed showstories";
	
	for (var k = 0; k < data.stories.length; k++) {
		data.stories[k].last_username = data.last_username;
		feed.appendChild(this.createPictureStoryDom(data.stories[k]));
	}
};

