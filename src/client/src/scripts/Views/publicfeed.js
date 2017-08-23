Anondraw.prototype.createPublicFeed = function createPublicFeed () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
	var content = container.appendChild(document.createElement("div"));
	content.className = "card";
	
	this.createPublicFeedContent(content);
	
	return container;
};

Anondraw.prototype.createPublicFeedContent = createPublicFeedContent (container) {
	var title = container.appendChild(document.createElement("h1"));
	title = "Public gallery feed";
	
	var storiesContainer = container.appendChild(document.createElement("div"));
	storiesContainer.classList.add("storiescontainer showstories");
	
	storiesContainer.appendChild(document.createTextNode("Loading..."));
	
	this.createPublicFeedFilters(container, storiesContainer);
	this.createPublicFeedStories(storiesContainer);
};

Anondraw.prototype.createPublicFeedStories = createPublicFeedStories (container) {
	this.account.getStories(function (stories) {
		console.log(stories);
		for (var k = 0; k < stories.length; k++) {
			
		}
	});
};

Anondraw.prototype.createPublicFeedFilters = createPublicFeedFilters (container, storiesContainer) {
	var filters = container.appendChild(document.createElement("div"));
	filters.classList.add("filters");

	/* Stories enabled filter */
	var showStories = filters.appendChild(document.createElement("input"));
	var label = filters.appendChild(document.createElement("label"));
	label.appendChild(document.createTextNode("Show stories"));
	
	showStories.addEventListener('change', function () {
		storiesContainer.classList.toggle('showstories', showStories.checked);
	});
};