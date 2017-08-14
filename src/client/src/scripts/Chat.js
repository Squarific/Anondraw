function Chat (container, onmessage, userSettings, emotesHash) {
	this.messagesDom = container.appendChild(document.createElement("div"));
	this.messagesDom.classList.add("messagecontainer");

	this.userSettings = userSettings;

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
	this.input.setAttribute("data-snap-ignore", "true");

	button = this.inputContainerDom.appendChild(document.createElement("div"));
	button.classList.add("button-small");
	button.setAttribute("data-snap-ignore", "true");

	button.appendChild(document.createTextNode("Send"));
	button.addEventListener("click", this.sendChat.bind(this));

	this.onMessage = onmessage || function () {};
	this.messageSound = new Audio("sounds/message.wav");

	this.emotesHash = emotesHash;

	//Visibility compatibility 
	// Set the name of the hidden property and the change event for visibility
	//var this.hidden, this.visibilityChange; 
	if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
		this.hidden = "hidden";
		this.visibilityChange = "visibilitychange";
	} else if (typeof document.msHidden !== "undefined") {
		this.hidden = "msHidden";
		this.visibilityChange = "msvisibilitychange";
	} else if (typeof document.webkitHidden !== "undefined") {
		this.hidden = "webkitHidden";
		this.visibilityChange = "webkitvisibilitychange";
	}
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

Chat.prototype.urlRegex = /(((http|ftp)s?):\/\/)?([\d\w]+\.)+[\d\w]{2,}(\/\S+)?/;
Chat.prototype.strictMatch1 = '(?:^|\\W)(';
Chat.prototype.strictMatch2 = ')(?:$|\\W)';
//(?:^|\W)(int)(?:$|\W) 
// matches:
// int, hey
Chat.prototype.matchSearchMode = 'gi';
Chat.prototype.coordinateRegex = /(http[\S]*)?([-]?\d\d*)(?:[\s*{0,4}]?,[\s*{0,4}]?)([-]?\d\d*)/gi;
// matches:
// 4444, 5555
// (4444,5555)
// 4444 ,5555
// 4444.5555
// 5555 , 55554

Chat.prototype.addMessage = function addMessage (user, message, userid, socketid) {
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
	var chatFilterByWordsArrStringified = localStorage.getItem("chatFilterByWordsArr");
	if(chatFilterByWordsArrStringified)
		var chatFilterByWordsArr = JSON.parse(chatFilterByWordsArrStringified);

	var overrideMuteAll = false;
	var mute = false;
	var globalNotification = false;
	if(chatFilterByWordsArr)
	for (var k = 0; k < chatFilterByWordsArr.length; k++){
		var messageContainsWord = -1;
		var matchContainsWordRegex = '';

		if(chatFilterByWordsArr[k].looseMatch){
			matchContainsWordRegex = chatFilterByWordsArr[k].inputText;
		} else
		{
			matchContainsWordRegex = this.strictMatch1 + chatFilterByWordsArr[k].inputText + this.strictMatch2;
		}
		
		var messageContainsWord = new RegExp(matchContainsWordRegex, this.matchSearchMode).test(message);
		
		if (chatFilterByWordsArr[k].inputText.length > 1 && messageContainsWord) {
			
			var opacityfordom = chatFilterByWordsArr[k].visibility * 0.01;
			
			messageDom.style.opacity =  opacityfordom;// 100 to 1.0
			if (chatFilterByWordsArr[k].overrideMute)
				overrideMuteAll = true;
			if (chatFilterByWordsArr[k].mute)
				mute = true;
			if (chatFilterByWordsArr[k].globalNotification)
				globalNotification = true;
		}
	}

	var chatFilterByPlayerArrStringified = localStorage.getItem("chatFilterByPlayerArr");
	if(chatFilterByPlayerArrStringified)
		var chatFilterByPlayerArr = JSON.parse(chatFilterByPlayerArrStringified);
	if(chatFilterByPlayerArr)
	for (var k = 0; k < chatFilterByPlayerArr.length; k++){
		var socketidMatches = chatFilterByPlayerArr[k].socketid && chatFilterByPlayerArr[k].socketid == socketid;
		var useridMatches = chatFilterByPlayerArr[k].userid && chatFilterByPlayerArr[k].userid == userid;
		if (useridMatches || socketidMatches) {
			messageDom.style.opacity = chatFilterByPlayerArr[k].visibility * 0.01; // 100 to 1.0
			if(chatFilterByPlayerArr[k].visibility == 0)
				messageDom.style.display = "none";
			if (chatFilterByPlayerArr[k].overrideMute)
				overrideMuteAll = true;
			if (chatFilterByPlayerArr[k].mute)
				mute = true;
			if (chatFilterByPlayerArr[k].globalNotification)
				globalNotification = true;
		}
	}

	this.addMessageToDom(messageDom, message);
	messageDom.title = time;
	messageDom.alt = time;

	// Only play audio if it was a normal message
	if (user !== message && ( !this.userSettings.getBoolean("Mute chat") || overrideMuteAll ) && !mute){
		this.messageSound.volume = localStorage.getItem("chatBeepVolume") || 1;
		this.messageSound.play();
	}
	if(globalNotification){

		if (Notification.permission !== "granted")
			Notification.requestPermission();
		else {
			if (document[this.hidden]) {
				var notification = new Notification(user + ":", {
					icon: 'http://www.anondraw.com/favicon.ico',
					body: message,
				});
			}
		}
	}
};

Chat.prototype.scrollChat = function scrollChat() {
	this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
};

Chat.prototype.addElementAsMessage = function addElementAsMessage (elem) {
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	
	var messageDom = this.messagesDom.appendChild(document.createElement("div"));
	messageDom.classList.add("chat-message");

	messageDom.appendChild(elem);

	if (max_scroll - elem.getBoundingClientRect().height <= old_scroll) { // is scrolled all the way down minus elem height
		this.scrollChat();
	}
};

Chat.prototype.addMessageToDom = function addMessageToDom (messageDom, message) {

	//message = message.replace(this.coordinateRegex, " $2,$3 "); // removes spaces from between coordinates so it can be split below
	var messages = message.split(" ");
	var temp;
	var result;

	for (var k = 0; k < messages.length; k++) {
		// Replace if url
		if (this.urlRegex.test(messages[k])){
			messages[k] = { url: messages[k] };
			continue;
		}
		// Replace if coordinate
		if(this.coordinateRegex.test(messages[k])){
			var first = messages[k].match(/[-]?\d*/)[0]; //first number
			var last = messages[k].match(/[-]?\d*$/)[0]; // last number	
			messages[k] = { coordinate: messages[k], x: first, y: last };
			continue;
		}
	}

	this.addMessageList(messageDom, messages);
};

// messages = ["a", "space", "splitted", "array", "with", "urls:", {url: "http://wwww.google.com"}]
// Replaces emotes with image
Chat.prototype.addMessageList = function addMessageList (messageDom, messages) {
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	
	for (var k = 0; k < messages.length; k++) {
		var emoteUrl = this.emotesHash[messages[k]];

		if (emoteUrl) {
			messageDom.appendChild(this.createEmote(messages[k], emoteUrl));
			messageDom.appendChild(document.createTextNode('\u00A0')); //&nbsp
			continue;
		}

		if (messages[k].url) {
			messageDom.appendChild(this.createUrl(messages[k].url));
			messageDom.appendChild(document.createTextNode('\u00A0')); //&nbsp
			continue;
		}

		if (messages[k].coordinate) {
			messageDom.appendChild(this.createCoordinate(messages[k].coordinate, messages[k].x, messages[k].y));
			messageDom.appendChild(document.createTextNode('\u00A0')); //&nbsp
			continue;
		}

		messageDom.appendChild(document.createTextNode(messages[k] + " "));
	}

	if (max_scroll - messageDom.getBoundingClientRect().height * 2 <= old_scroll ) {//scrolled all the way down minus new message * 2 to account for margins
		this.scrollChat();
	}
};

Chat.prototype.createUrl = function createUrl (url) {
	var a = document.createElement("a");
	a.href = url.indexOf("://") == -1 ? "http://" + url : url;
	a.target = "_blank";
	a.appendChild(document.createTextNode(url));
	return a;
};

Chat.prototype.createCoordinate = function createCoordinate (coordinateText, x, y) {
	var a = document.createElement("a");
	a.href = "javascript:void(0);"
	a.addEventListener("click", function (e) { // dispatch event code from: http://stackoverflow.com/a/33420324
		e.preventDefault();
		var doc;
		var node = $(".mouse-coords input:first").val(x)[0];
		if (node.ownerDocument) {
			doc = node.ownerDocument;
		} else if (node.nodeType == 9){
			// the node may be the document itself, nodeType 9 = DOCUMENT_NODE
			doc = node;
		}
		
		var eventName = "input";
		var eventClass = "";
		var event = doc.createEvent('Event');
		event.initEvent(eventName, true, true);

		event.synthetic = true;

		node.dispatchEvent(event, true);
		node = $(".mouse-coords input:last").val(y)[0];
		node.dispatchEvent(event, true);
	}.bind(this));

	a.appendChild(document.createTextNode(coordinateText));
	return a;
};

Chat.prototype.addAnimationMessage = function addAnimationMessage (animation, user, myAnimationsContext) {
	var elem = document.createElement("div");
	
	var validAnimation = function validAnimation(anim){
		return typeof anim.fps == "number" 
			&& anim.leftTop 
			&& typeof anim.leftTop[0] == "number"
			&& typeof anim.leftTop[1] == "number"
			&& typeof anim.squares == "number"
			&& typeof anim.sqwidth == "number"	
			&& typeof anim.sqheight == "number"
			&& typeof anim.gutter == "number"
			&& anim.bufferFrames;
	};
	
	var userSpan = elem.appendChild(document.createElement("span"));
		userSpan.appendChild(document.createTextNode(user + "'s animation: "));
		userSpan.style.color = this.string2Color(user);
	
	var aAdd = document.createElement("a");
	aAdd.href = "javascript:void(0);"
	aAdd.addEventListener("click", function (e) { // dispatch event code from: http://stackoverflow.com/a/33420324
		e.preventDefault();
		anim = JSON.parse(animation);
		if(validAnimation(anim)){
			myAnimationsContext.myAnimations.push(anim);
			
			myAnimationsContext.updateAnimationManager();
			myAnimationsContext.updateAnimationsCookieDelay();
		}
	
	}.bind(this));

	aAdd.appendChild(document.createTextNode("Add to animation manager"));
	
	elem.appendChild(aAdd);
	elem.appendChild(document.createTextNode(", "));
	
	var aRender = document.createElement("a");
	aRender.href = "javascript:void(0);"
	aRender.addEventListener("click", function (e) { 
		e.preventDefault();
		anim = JSON.parse(animation);
		if(validAnimation(anim)){
			var previousX = myAnimationsContext.paint.public.leftTopX;
			var previousY = myAnimationsContext.paint.public.leftTopY;
			this.addElementAsMessage(this.createCoordinate("click to go back to where you were before preview.", previousX, previousY));
			//myAnimationsContext.handleGotoAndCenter(anim.leftTop[0] + (anim.sqwidth * anim.squares), anim.leftTop[0]);
			myAnimationsContext.handleGotoAndCenter(anim.leftTop[0] , anim.leftTop[1]);
			var chunkSize = myAnimationsContext.paint.background.settings.chunkSize;
			var zoom = myAnimationsContext.paint.background.zoom;
			
			var lastFrame = anim.squares -1;
			var toOffsetX = anim.sqwidth * lastFrame;
			toOffsetX += anim.gutter * lastFrame - 1;
			var to = [anim.leftTop[0] + toOffsetX, anim.leftTop[1] + anim.sqheight];
			
			var startChunkX = Math.floor(anim.leftTop[0] / chunkSize),
				endChunkX   = Math.ceil(to[0] / chunkSize),
				startChunkY = Math.floor(anim.leftTop[1] / chunkSize),
				endChunkY   = Math.ceil(to[1] / chunkSize);
			
			for (var chunkX = startChunkX; chunkX < endChunkX; chunkX++) {
				for (var chunkY = startChunkY; chunkY < endChunkY; chunkY++) {
					myAnimationsContext.paint.background.drawChunk(chunkX, chunkY);
				}
			}
			
			setTimeout(myAnimationsContext.renderMyAnimation.bind(myAnimationsContext, anim), 4000);			
		}
		
	}.bind(this));

	aRender.appendChild(document.createTextNode("Preview"));
	
	elem.appendChild(aRender);
	
	this.addElementAsMessage(elem);
	
}; 

Chat.prototype.createEmote = function createEmote (name, url) {
	var img = document.createElement("img");

	img.title = name;
	img.alt = name;
	img.src = url;

	img.className = "drawtogether-emote";
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	img.onload = function() {
		
		img.onload = null;
		if (max_scroll - img.parentNode.getBoundingClientRect().height * 2 <= old_scroll ) 
			this.scrollChat();
	}.bind(this);

	return img;
};

Chat.prototype.sendChat = function sendChat () {
	this.onMessage(this.input.value);
	this.input.value = "";
};
