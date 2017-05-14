Anondraw.prototype.createMessagePage = function createMessagePage (params) {
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
	messages.className = "card messagecard";
	messages.style.padding = "2em";
	messages.style.cursor = "wait";
	messages.appendChild(document.createTextNode("Loading..."));
	
	this.account.isLoggedIn(function (err, loggedIn) {
		while (messages.firstChild) messages.removeChild(messages.firstChild);
		
		if (err) {
			messages.classList.add("error");
			messages.appendChild(document.createTextNode(err));
			messages.style.cursor = "";
			console.log(err);
			return;
		}
		
		if (!loggedIn) {
			messages.classList.add("error");
			messages.appendChild(document.createTextNode("You need to be logged in to access your messages! "));
			var a = messages.appendChild(document.createElement("a"));
			a.href = "/login";
			a.appendChild(document.createTextNode("Click here to login"));
			console.log(err);
			messages.style.cursor = "";
			return;
		}
		
		this.messages.getMessageList(function (err, data) {
			while (messages.firstChild) messages.removeChild(messages.firstChild);
			
			if (err) {
				messages.classList.add("error");
				messages.appendChild(document.createTextNode(err));
				console.log(err);
				return;
			}
			
			if (!data || !data.list) {
				messages.classList.add("error");
				messages.appendChild(document.createTextNode("An unexpected error occured: NO DATA OR DATA CONTAINED NO LIST " + !!data + " " + !!data.list));
				return;
			}
			
			var target = 0;
			/* Add the conversation of the params if they aren't in the list yet */
			if (params) {
				var found = false;
			
				for (var k = 0; k < data.list.length; k++) {
					if (data.list[k].partner == params.id) {
						found = true;
						target = k;
					}
				}
				
				if (!found) {
					data.list.unshift({
						partner: params.id,
						last_username: decodeURIComponent(params.username)
					});
				}
			}
			
			messages.style.padding = "";
			messages.style.cursor = "";
			
			var conversations = messages.appendChild(document.createElement("div"));
			conversations.className = "conversations";
			
			var conversationContainer = messages.appendChild(document.createElement("div"));
			conversationContainer.className = "conversationContainer";
			
			var lastSelected;
			function showConversation (partner, conversation) {
				lastSelected ? lastSelected.classList.remove("selected") : "";
				conversation.classList.add("selected");
				lastSelected = conversation;
				
				while (conversationContainer.firstChild) conversationContainer.removeChild(conversationContainer.firstChild);
				var messageContainer = conversationContainer.appendChild(document.createElement("div"));
				messageContainer.className = "messageContainer";
				
				var messageInput = conversationContainer.appendChild(document.createElement("input"));
				messageInput.focus();
				messageInput.addEventListener("keydown", function (event) {
					if (event.keyCode == 13) {
						this.messages.sendMessage(partner, messageInput.value, function (err, data) {
							if (err) {
								var message = messageContainer.appendChild(document.createElement("div"));
								message.className = "message error";
								message.appendChild(document.createTextNode("Could not send message: " + err));
								console.log(err);
								messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.getBoundingClientRect().height;
								return;
							}
						});
						
						var message = messageContainer.appendChild(document.createElement("div"));
						message.className = "message";
						message.appendChild(document.createTextNode(messageInput.value));
						messageInput.value = "";
						messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.getBoundingClientRect().height;
					}
				}.bind(this));
				
				this.messages.getMessages(partner, undefined, function (err, data) {
					while (messageContainer.firstChild) messageContainer.removeChild(messageContainer.firstChild);
					
					if (err) {
						messageContainer.classList.add("error");
						messageContainer.appendChild(document.createTextNode(err));
						console.log(err);
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
						
						if (data.messages[k].fromId == partner) message.classList.add("fromPartner");
						
						message.appendChild(document.createTextNode(data.messages[k].message));
						message.title = (new Date(data.messages[k].message.send)).toLocaleString();
					}
					
					messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.getBoundingClientRect().height;
				});
			}
			
			if (data.list.length == 0) {
				conversations.style.padding = "2em";
				conversations.appendChild(document.createTextNode("You have had no conversations yet!"));
			}
			
			for (var k = 0; k < data.list.length; k++) {
				var conversation = conversations.appendChild(document.createElement("div"));
				conversation.appendChild(document.createTextNode(data.list[k].last_username));
				conversation.addEventListener("click", showConversation.bind(this, data.list[k].partner, conversation));
				if (k == target) showConversation.call(this, data.list[target].partner, conversation);
			}
		}.bind(this));
	}.bind(this));
	
	
	return container;
}