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
			var story = container.appendChild(document.createElement("div"));
			story.className = "story";
			
			var imageContainer = story.appendChild(document.createElement("div"));
			imageContainer.className = "imagecontainer";
			
			var a = imageContainer.appendChild(document.createElement("a"));
			a.href = "http://anondraw.com/userimages/" + data.stories[k].image + ".png";
			a.target = "_blank";
			
			var image = a.appendChild(document.createElement("img"));
			image.src = "http://anondraw.com/userimages/" + data.stories[k].image + ".png";
			image.alt = data.stories[k].story;
			image.title = data.stories[k].story;
			
			var storytext = story.appendChild(document.createElement("div"));
			storytext.className = "storytext";
			
			if (data.stories[k].story) {
				var actualtext = storytext.appendChild(document.createElement("div"));
				actualtext.className = "actualtext";
				
				var splitStory = data.stories[k].story.split("\n");
				for (var i = 0; i < splitStory.length; i++) {
					actualtext.appendChild(document.createTextNode(splitStory[i] || ""));
					actualtext.appendChild(document.createElement("br"));
				}
			}
			
			var credit = storytext.appendChild(document.createElement("div"));
			credit.className = "credit";
			credit.appendChild(document.createTextNode("-" + data.stories[k].last_username + " " + (new Date(data.stories[k].created)).toLocaleString()));
		}
	});
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