Anondraw.prototype.createPublicFeed = function createPublicFeed () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
	var content = container.appendChild(document.createElement("div"));
	content.className = "card gallery";
	
	this.createPublicFeedContent(content);
	
	return container;
};

Anondraw.prototype.createPublicFeedContent = function createPublicFeedContent (container) {
	var title = container.appendChild(document.createElement("h1"));
	title.appendChild(document.createTextNode("Public gallery"));
	
	var storiesContainer = document.createElement("div");
	this.createPublicFeedFilters(container, storiesContainer);

	storiesContainer.className = "storiescontainer showstories";	
	storiesContainer.appendChild(document.createTextNode("Loading..."));
	container.appendChild(storiesContainer);
	this.createPublicFeedStories(storiesContainer);	
};

Anondraw.prototype.createPublicFeedStories = function createPublicFeedStories (container) {
	this.account.getPictureStories(function (err, data) {
		while (container.firstChild) container.removeChild(container.firstChild);
		
		console.log(data);
		if (err || data.err || data.error) {
			container.appendChild(document.createTextNode(err || data.err || data.error));
			return;
		}
		
		for (var k = 0; k < data.stories.length; k++) {
			container.appendChild(this.createPictureStoryDom(data.stories[k]));
		}
	}.bind(this));
};

Anondraw.prototype.createPictureStoryDom = function createPictureStoryDom (storyData) {
	var story = document.createElement("div");
	story.className = "story";
	
	var imageContainer = story.appendChild(document.createElement("div"));
	imageContainer.className = "imagecontainer";
	
	var a = imageContainer.appendChild(document.createElement("a"));
	a.href = "http://anondraw.com/userimages/" + storyData.image + ".png";
	a.target = "_blank";
	
	var image = a.appendChild(document.createElement("img"));
	image.src = "http://anondraw.com/userimages/" + storyData.image + ".png";
	image.alt = storyData.story;
	image.title = storyData.story;
	
	var storytext = story.appendChild(document.createElement("div"));
	storytext.className = "storytext";
	
	if (storyData.story) {
		var actualtext = storytext.appendChild(document.createElement("div"));
		actualtext.className = "actualtext";
		
		var splitStory = storyData.story.split("\n");
		for (var i = 0; i < splitStory.length; i++) {
			actualtext.appendChild(document.createTextNode(splitStory[i] || ""));
			actualtext.appendChild(document.createElement("br"));
		}
	}
	
	var credit = storytext.appendChild(document.createElement("div"));
	credit.className = "credit";
	credit.appendChild(document.createTextNode("-" + storyData.last_username + " " + (new Date(storyData.created)).toLocaleString()));
	
	return story;
};

Anondraw.prototype.createPublicFeedFilters = function createPublicFeedFilters (container, storiesContainer) {
	var filters = container.appendChild(document.createElement("div"));
	filters.classList.add("filters");

	/* Stories enabled filter */
	var showStories = filters.appendChild(document.createElement("input"));
	showStories.type = "checkbox";
	showStories.checked = true;
	showStories.id = "showstories";
	
	var label = filters.appendChild(document.createElement("label"));
	label.htmlFor = "showstories";
	label.appendChild(document.createTextNode("Show stories"));
	
	showStories.addEventListener('change', function () {
		storiesContainer.classList.toggle('showstories', showStories.checked);
	});
};