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

Chat.prototype.emotesOrder = ["Kappa", "CasualLama", "Nyan"];
Chat.prototype.emotesHash = {
	"Kappa": "images/emotes/Kappa.png",
	"CasualLama": "images/emotes/CasualLama.png",
	"Nyan": "images/emotes/Nyan.png"
};

Chat.prototype.urlRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;

Chat.prototype.addMessage = function addMessage (user, message) {
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	
	var messageDom = this.messagesDom.appendChild(document.createElement("div"));
	messageDom.classList.add("chat-message");

	var time = new Date();
	time = ("0" + time.getHours()).slice(-2) + ":"
	     + ("0" + time.getMinutes()).slice(-2) + ":"
	     + ("0" + time.getSeconds()).slice(-2);

	// Make it possible to call this function without user
	if (typeof message == "undefined") {
		message = user;
	} else {
		var userSpan = messageDom.appendChild(document.createElement("span"));
		userSpan.appendChild(document.createTextNode(user + ": "));
		userSpan.style.color = this.string2Color(user);
	}

	this.addMessageToDom(messageDom, message);
	messageDom.title = time;
	messageDom.alt = time;

	if (max_scroll <= old_scroll) {
		this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
	}
};

Chat.prototype.addElementAsMessage = function addElementAsMessage (elem) {
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	
	var messageDom = this.messagesDom.appendChild(document.createElement("div"));
	messageDom.classList.add("chat-message");

	messageDom.appendChild(elem);

	if (max_scroll <= old_scroll) {
		this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
	}
};

Chat.prototype.addMessageToDom = function addMessageToDom (messageDom, message) {
	var messages = [];
	var temp;
	var result;

	// Split the message on all urls
	while (result = this.urlRegex.exec(message)) {
		messages.push(message.slice(0, result.index));                  // Add the part before the url
		messages.push({url: result[0]});                                // Add the url
		message = message.slice(result.index + result[0].length);       // Prepare to search after the url
	}

	// Add the last part that didnt contain any urls
	messages.push(message);

	// Run trough all the emotes
	for (var eKey = 0; eKey < this.emotesOrder.length; eKey++) {
		var emoteName = this.emotesOrder[eKey];
		temp = [];

		// Replace in all messages the current emotetext
		for (var mKey = 0; mKey < messages.length; mKey++) {
			// Don't replace if emote or url
			if (messages[mKey].url || this.emotesHash[messages[mKey]]) {
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

// messages = ["a lit of messages", "unlimited", "with urls: ", {url: "http://wwww.google.com"}]
Chat.prototype.addMessageList = function addMessageList (messageDom, messages) {
	for (var k = 0; k < messages.length; k++) {
		var emoteUrl = this.emotesHash[messages[k]];

		if (emoteUrl) {
			messageDom.appendChild(this.createEmote(messages[k], emoteUrl));
			continue;
		}

		if (messages[k].url) {
			var a = messageDom.appendChild(this.createUrl(messages[k].url));
			continue;
		}

		messageDom.appendChild(document.createTextNode(messages[k]));
	}
};

Chat.prototype.createUrl = function createUrl (url) {
	var a = document.createElement("a");
	a.href = url;
	a.appendChild(document.createTextNode(url));
	return a;
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