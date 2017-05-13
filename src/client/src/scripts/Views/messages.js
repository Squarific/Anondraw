Anondraw.prototype.createMessagePage = function createMessagePage () {
	var container = document.createElement("div");
	
	/*
		Top bar
	*/
	
	var topBar = container.appendChild(document.createElement("div"));
	topBar.className = "topbar";
	
	var logo = topBar.appendChild(document.createElement("a"));
	logo.appendChild(document.createTextNode("Anondraw"));
	logo.className = "logo";
	logo.href = "/";
	logo.setAttribute("data-navigo", "");
	
	var messages = container.appendChild(document.createElement("div"));
	messages.className = "card";
	messages.style.padding = "2em";
	messages.style.cursor = "wait";
	messages.appendChild(document.createTextNode("Loading..."));
	
	this.messages.getMessageList(function (err, messages) {
		if (err) {
			messages.classList.add("error");
			while (messages.firstChild) messages.removeChild(messages.firstChild);
			messages.appendChild(document.createTextNode(err));
			return;
		}
		
		
	});
	
	return container;
}