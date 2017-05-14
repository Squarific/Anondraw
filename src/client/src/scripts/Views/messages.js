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
	
	this.messages.getMessageList(function (err, data) {
		while (messages.firstChild) messages.removeChild(messages.firstChild);
		
		if (err) {
			messages.classList.add("error");
			messages.appendChild(document.createTextNode(err));
			return;
		}
		
		if (!data || !data.list) {
			messages.classList.add("error");
			messages.appendChild(document.createTextNode("An unexpected error occured: NO DATA OR DATA CONTAINED NO LIST " + !!data + " " + !!data.list));
			return;
		}
		
		var conversations = messages.appendChild(document.createElement("div"));
		conversations.className = "conversations";
		
		var messageContainer = messages.appendChild(document.createElement("div"));
		messageContainer.className = "messageContainer";
		
		var lastSelected;
		function showConversation (partner, conversation) {
			lastSelected.classList.remove("selected");
			conversation.classList.add("selected");
			lastSelected = conversation;
			
			messageContainer.appendChild(document.createTextNode("Loading..."));
			
			this.messages.getMessages(partner, undefined, function (err, data) {
				while (messageContainer.firstChild) messageContainer.removeChild(messageContainer.firstChild);
				
				if (err) {
					messageContainer.classList.add("error");
					messageContainer.appendChild(document.createTextNode(err));
					return;
				}
				
				if (!data || !data.messages) {
					messages.classList.add("error");
					messages.appendChild(document.createTextNode("An unexpected error occured: NO DATA OR DATA CONTAINED NO MESSAGES " + !!data + " " + !!data.messages));
					return;
				}
				
				for (var k = 0; k < data.messages.length; k++) {
					var message = messageContainer.appendChild(document.createElement("div"));
					message.classList.add("message");
					
					if (data.messages[k].toId == partner) message.classList.add("fromPartner");
					
					message.appendChild(document.createTextNode(data.messages[k].message));
					message.title = (new Date(data.messages[k].message.send)).toLocaleString();
				}
			});
		}
		
		for (var k = 0; k < data.list.length; k++) {
			var conversation = conversations.appendChild(document.createElement("div"));
			conversation.appendChild(document.createTextNode(data.list[k].last_username));
			conversation.addEventListener("click", showConversation.bind(this, data.list[k].partner, conversation));
		}
	}.bind(this));
	
	return container;
}