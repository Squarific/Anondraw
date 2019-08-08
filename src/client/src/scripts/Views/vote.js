Anondraw.prototype.createVotePage = function createVotePage () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
	var content = container.appendChild(document.createElement("div"));
	
	var messages = content.appendChild(document.createElement("div"));
	messages.className = "card";
	messages.style.padding = "2em";
	messages.style.cursor = "wait";
	messages.appendChild(document.createTextNode("Loading..."));
	
	this.account.getContestEntries(this.view.createContestEntries.bind(this, content));
	
	return container;
};

/*
	Needs to be bound to anondraw before calling
*/
Anondraw.prototype.view.createContestEntries = function createContestEntries (container, err, data) {
	while (container.firstChild) container.removeChild(container.firstChild);
	
	var info = container.appendChild(document.createElement("div"));
	info.className = "card";
	info.style.padding = "2em";

	if (err) {
		info.appendChild(document.createTextNode(err));
		return;
	}
	
	info.appendChild(document.createTextNode("These are the images you have not yet voted for. You can upvote however many images as you'd like. You can only upvote every image once. Your vote will be weighted with your reputation."));
	
	var entriesDom = container.appendChild(document.createElement("div"));
	entriesDom.classList.add("entries");
	
	for (var k = 0; k < data.entries.length; k++) {
		entriesDom.appendChild(this.view.createEntry.call(this, data.entries[k]));
	}
};

/*
	Needs to be bound to anondraw before calling
*/
Anondraw.prototype.view.createEntry = function createEntry (entry) {
	var story = document.createElement("div");
	story.className = "story entry";
	
	var error = story.appendChild(document.createElement("div"));
	error.classList.add("status");
	
	var imageContainer = story.appendChild(document.createElement("div"));
	imageContainer.className = "imagecontainer";
	
	var a = imageContainer.appendChild(document.createElement("a"));
	a.href = "http://anondraw.com/userimages/" + entry.image + ".png";
	a.target = "_blank";
	
	var image = a.appendChild(document.createElement("img"));
	image.src = "http://anondraw.com/userimages/" + entry.image + ".png";
	
	var voteButton = story.appendChild(document.createElement("div"));
	voteButton.className = "button secondary vote";
	voteButton.appendChild(document.createTextNode("Vote for this image"));
	voteButton.addEventListener("click", function () {
		while (error.firstChild) error.removeChild(error.firstChild);
		story.classList.add("disabled");

		this.account.vote(entry.image, function (err) {
			if (err) {
				story.classList.remove("disabled");
				error.appendChild(document.createTextNode(err));
				return;
			}
			
			story.parentNode.removeChild(story);
		});
	}.bind(this));
	
	return story;
};