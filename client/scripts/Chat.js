function Chat (container, onmessage) {
	this.messagesDom = container.appendChild(document.createElement("div"));
	this.messagesDom.classList.add("messagecontainer");

	this.inputContainerDom = container.appendChild(document.createElement("div"));
	this.inputContainerDom.classList.add("inputcontainer-poll");

	this.input = this.inputContainerDom.appendChild(document.createElement("input"));
	this.input.placeholder = "Chatmessage here...";
	this.input.addEventListener("keypress", function (event) {
		if (event.keyCode == 13) {
			this.sendChat();
		}
	}.bind(this));
	this.input.maxLength = 255;

	button = this.inputContainerDom.appendChild(document.createElement("div"));
	button.classList.add("button-small");
	button.classList.add("voteoption");

	button.appendChild(document.createTextNode("Send"));
	button.addEventListener("click", this.sendChat.bind(this));

	this.onMessage = onmessage || function () {};
}

Chat.prototype.addMessage = function addMessage (user, message) {
		max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
		old_scroll = Math.ceil(this.messagesDom.scrollTop);
		console.log(max_scroll, old_scroll);
		
		messageDom = this.messagesDom.appendChild(document.createElement("div"));
		messageDom.classList.add("chat-message");
		messageDom.appendChild(document.createTextNode(user + ": " + message));

		if (max_scroll <= old_scroll) {
			this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
		}
};

Chat.prototype.sendChat = function sendChat () {
	this.onMessage(this.input.value);
	this.input.value = "";
};