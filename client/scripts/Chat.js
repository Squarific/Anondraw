function Chat (container, onmessage) {
	this.messagesDom = container.appendChild(document.createElement("div"));
	this.messagesDom.classList.add("messagecontainer");

	this.inputContainerDom = container.appendChild(document.createElement("div"));
	this.inputContainerDom.classList.add("inputcontainer");

	this.input = this.inputContainerDom.appendChild(document.createElement("input"));
	this.input.placeholder = "Chatmessage here...";
	this.input.className = "drawtogheter-chat-input"
	this.input.addEventListener("keypress", function (event) {
		if (event.keyCode == 13) {
			this.sendChat();
		}
	}.bind(this));
	this.input.maxLength = 255;

	button = this.inputContainerDom.appendChild(document.createElement("div"));
	button.classList.add("button-small");

	button.appendChild(document.createTextNode("Send"));
	button.addEventListener("click", this.sendChat.bind(this));

	this.onMessage = onmessage || function () {};
}

Chat.prototype.string2Color = function string2Color (str) {
    var h = 2348;
    var s = 0.9;
    var l = 0.4;
    
    for(var j = Math.max(str.length - 1, 2); j >= 0; j--)
        for(var i = str.length-1; i >= 0; i--) {
            h = ((h << 5) - h) + ~ str.charCodeAt(i);
        }
    
    if(h < 0) {
        h = -h;
        l = 0.35;
    }
    
    if(h > 360) {
        var c = parseInt(h / 360.0);
        h -= c * 360;
        
        if(c % 3 === 0) {
            s = 1;
        } else if(c % 2 === 0) {
            s = 0.95;
        }
    }
    
    return "hsl("+ h +", "+ s*100 +"%, "+ l*70 +"%)";
};

Chat.prototype.emotesOrder = ["Kappa"];
Chat.prototype.emotesHash = {
	"Kappa": "images/emotes/Kappa.png"
};

Chat.prototype.addMessage = function addMessage (user, message) {
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	
	var messageDom = this.messagesDom.appendChild(document.createElement("div"));
	messageDom.classList.add("chat-message");

	var time = new Date();
	time = ("0" + time.getHours()).slice(-2) + ":"
	     + ("0" + time.getMinutes()).slice(-2) + ":"
	     + ("0" + time.getSeconds()).slice(-2);

	if (typeof message == "undefined")
		messageDom.appendChild(document.createTextNode("[" + time + "] " + user));
	else {
		messageDom.appendChild(document.createTextNode("[" + time + "] "));

		var userSpan = messageDom.appendChild(document.createElement("span"));
		userSpan.innerText = user + ": ";
		userSpan.style.color = this.string2Color(user);

		this.addMessageToDom(messageDom, message);
	}

	if (max_scroll <= old_scroll) {
		this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
	}
};

Chat.prototype.addMessageToDom = function addMessageToDom (messageDom, message) {
	var messages = [message];
	var temp;

	// Run trough all the emotes
	for (var eKey = 0; eKey < this.emotesOrder.length; eKey++) {
		var emoteName = this.emotesOrder[eKey];
		temp = [];

		// Replace in all messages the current emotetext
		for (var mKey = 0; mKey < messages.length; mKey++) {

			// If the text is completly an emote, don't replace parts of it
			if (this.emotesHash[messages[mKey]]) {
				temp.push(messages[mKey]);
				continue;
			}

			// Take out all the emote text
			var split = messages[mKey].split(emoteName);

			// Add them to the temp list
			for (var k = 0; k < split.length; k++) {
				temp.push(split[k]);
				temp.push(emoteName);
			}

			// Remove the last push
			temp.pop();
		}

		messages = temp;
	}

	this.addMessageList(messageDom, messages);	
};

Chat.prototype.addMessageList = function addMessageList (messageDom, messages) {
	for (var k = 0; k < messages.length; k++) {
		var emoteUrl = this.emotesHash[messages[k]];

		if (emoteUrl) {
			messageDom.appendChild(this.createEmote(messages[k], emoteUrl));
			continue;
		}

		messageDom.appendChild(document.createTextNode(messages[k]));
	}
};

Chat.prototype.createEmote = function createEmote (name, url) {
	var img = document.createElement("img");

	img.title = name;
	img.alt = name;
	img.src = url;

	img.className = "drawtogether-emote";

	return img;
};

Chat.prototype.sendChat = function sendChat () {
	this.onMessage(this.input.value);
	this.input.value = "";
};