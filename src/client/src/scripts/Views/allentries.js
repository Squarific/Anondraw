Anondraw.prototype.createAllEntriesPage = function createAllEntriesPage (params) {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
	var content = container.appendChild(document.createElement("div"));
	
	var messages = content.appendChild(document.createElement("div"));
	messages.className = "card";
	messages.style.padding = "2em";
	messages.style.cursor = "wait";
	messages.appendChild(document.createTextNode("Loading..."));
	
	this.account.getAllEntries(params, this.view.allentries.createContestEntries.bind(this, content, params));
	
	return container;
};

Anondraw.prototype.view.allentries = {};

/*
	Needs to be bound to anondraw before calling
*/
Anondraw.prototype.view.allentries.createContestEntries = function createContestEntries (container, params, err, data) {
	while (container.firstChild) container.removeChild(container.firstChild);
	
	var info = container.appendChild(document.createElement("div"));
	info.className = "card";
	info.style.padding = "2em";

	if (err) {
		info.appendChild(document.createTextNode(err));
		return;
	}
	
	var months = ["January", "February", "March", "April", "May", "June", "July", "Augustus", "September", "October", "November", "December"];
	info.appendChild(document.createTextNode("These were all the entries for " + months[params.month - 1] + " " + params.year));
	
	var entriesDom = container.appendChild(document.createElement("div"));
	entriesDom.classList.add("entries");
	
	for (var k = data.entries.length - 1; k >= 0; k--) {
		entriesDom.appendChild(this.view.allentries.createEntry.call(this, data.entries[k]));
	}
};

/*
	Needs to be bound to anondraw before calling
*/
Anondraw.prototype.view.allentries.createEntry = function createEntry (entry) {
	var story = document.createElement("div");
	story.className = "story entry";
	
	var error = story.appendChild(document.createElement("div"));
	error.classList.add("status");
	
	var imageContainer = story.appendChild(document.createElement("div"));
	imageContainer.className = "imagecontainer";
	
	var a = imageContainer.appendChild(document.createElement("a"));
	a.href = "https://www.anondraw.com/userimages/" + entry.image + ".png";
	a.target = "_blank";
	
	var image = a.appendChild(document.createElement("img"));
	image.src = "https://www.anondraw.com/userimages/" + entry.image + ".png";
	
	var members = story.appendChild(document.createElement("span"));
	
	for (var k = 0; k < entry.members.length; k++) {
		var name = members.appendChild(document.createElement("a"));
		var last = k == (entry.members.length - 1);
		name.appendChild(document.createTextNode(entry.members[k].name + (last ? "" : ", ")));
		name.className = "member";
		
		if (entry.members[k].href) name.href = entry.members[k].href;
		name.target = "_blank";
	}
	
	return story;
};