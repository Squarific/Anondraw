function Chat (container, onmessage, userSettings) {
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

Chat.prototype.emotesOrder = [
	"CasualLama","Nyan","RedCoat","BCouch","FUNgineer","GrammarKing",
	"JonCarnage","NotLikeThis","OMGScoots","NoNoSpot","OSkomodo","ShazBotstix",
	"PuppeyFace","CorgiDerp","OptimizePrime","PraiseIt","TTours","YouWHY",
	"cmonBruh","PunchTrees","SriHead","Jebaited","Keepo","panicBasket",
	"BatChest","BloodTrail","HotPokket","CoolCat","SuperVinlin","PicoMause",
	"Volcania","OhMyDog","SeemsGood","SMOrc","StoneLightning","UnSane",
	"DogFace","EleGiggle","KappaRoss","FrankerZ","VoHiYo","MVGame","RaccAttack",
	"UncleNox","HeyGuys","Kappa","Kippa","ShadyLulu","SoBayed","SSSsss",
	"TinyFace","WTRuck","BigBrother","BORT","PanicVis","KAPOW","TriHard",
	"MingLee","OSfrog","PermaSmug","PeteZaroll","ArsonNoSexy","FreakinStinkin",
	"GingerPower","PipeHype","CougarHunt","FPSMarksman","HassanChop","TheTarFu",
	"deIlluminati","SwiftRage","TF2John","RalpherZ","RuleFive","TheRinger",
	"ThunBeast","BrainSlug","DansGame","FunRun","ItsBoshyTime","KappaPride",
	"ArgieB8","BlargNaut","BuddhaBar","NotATK","PRChase","ShibeZ","KevinTurtle",
	"NinjaTroll","RitzMitz","KappaWealth","PMSTwin","TooSpicy","WholeWheat",
	"EvilFetus","PogChamp","SMSkull","twitchRaid","UleetBackup","WutFace",
	"ANELE","AsianGlow","BrokeBack","KappaClaus","MikeHogu","PartyTime",
	"TheThing","bleedPurple","FuzzyOtterOO","HassaanChop","OneHand","BabyRage",
	"DAESuppy","Mau5","riPepperonis","DOOMGuy","mcaT","OpieOP","duDudu",
	"EagleEye","FailFish","MrDestructoid","PeoplesChamp","4Head","BCWarrior",
	"DendiFace","WinWaker","PeteZarollTie","SoonerLater","VaultBoy","Kreygasm",
	"Poooound","HumbleLife","JKanStyle","ResidentSleeper","StrawBeary",
	"AthenaPMS","DatSheffy","deExcite","OSsloth","PazPazowitz","PJSalt",
	"BibleThump","BionicBunion","DBstyle", "WillDraw4Rep"
];
Chat.prototype.emotesHash = {
	"CasualLama": "images/emotes/CasualLama.png",
	"Nyan": "images/emotes/Nyan.png",
	"4Head": "images/emotes/4Head.png",
	"ANELE": "images/emotes/ANELE.png",
	"ArgieB8": "images/emotes/ArgieB8.png",
	"ArsonNoSexy": "images/emotes/ArsonNoSexy.png",
	"AsianGlow": "images/emotes/AsianGlow.png",
	"AthenaPMS": "images/emotes/AthenaPMS.png",
	"BCWarrior": "images/emotes/BCWarrior.png",
	"BCouch": "images/emotes/BCouch.png",
	"BORT": "images/emotes/BORT.png",
	"BabyRage": "images/emotes/BabyRage.png",
	"BatChest": "images/emotes/BatChest.png",
	"BibleThump": "images/emotes/BibleThump.png",
	"BigBrother": "images/emotes/BigBrother.png",
	"BionicBunion": "images/emotes/BionicBunion.png",
	"BlargNaut": "images/emotes/BlargNaut.png",
	"BloodTrail": "images/emotes/BloodTrail.png",
	"BrainSlug": "images/emotes/BrainSlug.png",
	"BrokeBack": "images/emotes/BrokeBack.png",
	"BuddhaBar": "images/emotes/BuddhaBar.png",
	"CoolCat": "images/emotes/CoolCat.png",
	"CorgiDerp": "images/emotes/CorgiDerp.png",
	"CougarHunt": "images/emotes/CougarHunt.png",
	"DAESuppy": "images/emotes/DAESuppy.png",
	"DBstyle": "images/emotes/DBstyle.png",
	"DOOMGuy": "images/emotes/DOOMGuy.png",
	"DansGame": "images/emotes/DansGame.png",
	"DatSheffy": "images/emotes/DatSheffy.png",
	"DendiFace": "images/emotes/DendiFace.png",
	"DogFace": "images/emotes/DogFace.png",
	"EagleEye": "images/emotes/EagleEye.png",
	"EleGiggle": "images/emotes/EleGiggle.png",
	"EvilFetus": "images/emotes/EvilFetus.png",
	"FPSMarksman": "images/emotes/FPSMarksman.png",
	"FUNgineer": "images/emotes/FUNgineer.png",
	"FailFish": "images/emotes/FailFish.png",
	"FrankerZ": "images/emotes/FrankerZ.png",
	"FreakinStinkin": "images/emotes/FreakinStinkin.png",
	"FunRun": "images/emotes/FunRun.png",
	"FuzzyOtterOO": "images/emotes/FuzzyOtterOO.png",
	"GingerPower": "images/emotes/GingerPower.png",
	"GrammarKing": "images/emotes/GrammarKing.png",
	"HassaanChop": "images/emotes/HassaanChop.png",
	"HassanChop": "images/emotes/HassanChop.png",
	"HeyGuys": "images/emotes/HeyGuys.png",
	"HotPokket": "images/emotes/HotPokket.png",
	"HumbleLife": "images/emotes/HumbleLife.png",
	"ItsBoshyTime": "images/emotes/ItsBoshyTime.png",
	"JKanStyle": "images/emotes/JKanStyle.png",
	"Jebaited": "images/emotes/Jebaited.png",
	"JonCarnage": "images/emotes/JonCarnage.png",
	"KAPOW": "images/emotes/KAPOW.png",
	"Kappa": "images/emotes/Kappa.png",
	"KappaClaus": "images/emotes/KappaClaus.png",
	"KappaPride": "images/emotes/KappaPride.png",
	"KappaRoss": "images/emotes/KappaRoss.png",
	"KappaWealth": "images/emotes/KappaWealth.png",
	"Keepo": "images/emotes/Keepo.png",
	"KevinTurtle": "images/emotes/KevinTurtle.png",
	"Kippa": "images/emotes/Kippa.png",
	"Kreygasm": "images/emotes/Kreygasm.png",
	"MVGame": "images/emotes/MVGame.png",
	"Mau5": "images/emotes/Mau5.png",
	"MikeHogu": "images/emotes/MikeHogu.png",
	"MingLee": "images/emotes/MingLee.png",
	"MrDestructoid": "images/emotes/MrDestructoid.png",
	"NinjaTroll": "images/emotes/NinjaTroll.png",
	"NoNoSpot": "images/emotes/NoNoSpot.png",
	"NotATK": "images/emotes/NotATK.png",
	"NotLikeThis": "images/emotes/NotLikeThis.png",
	"OMGScoots": "images/emotes/OMGScoots.png",
	"OSfrog": "images/emotes/OSfrog.png",
	"OSkomodo": "images/emotes/OSkomodo.png",
	"OSsloth": "images/emotes/OSsloth.png",
	"OhMyDog": "images/emotes/OhMyDog.png",
	"OneHand": "images/emotes/OneHand.png",
	"OpieOP": "images/emotes/OpieOP.png",
	"OptimizePrime": "images/emotes/OptimizePrime.png",
	"PJSalt": "images/emotes/PJSalt.png",
	"PMSTwin": "images/emotes/PMSTwin.png",
	"PRChase": "images/emotes/PRChase.png",
	"PanicVis": "images/emotes/PanicVis.png",
	"PartyTime": "images/emotes/PartyTime.png",
	"PazPazowitz": "images/emotes/PazPazowitz.png",
	"PeoplesChamp": "images/emotes/PeoplesChamp.png",
	"PermaSmug": "images/emotes/PermaSmug.png",
	"PeteZaroll": "images/emotes/PeteZaroll.png",
	"PeteZarollTie": "images/emotes/PeteZarollTie.png",
	"PicoMause": "images/emotes/PicoMause.png",
	"PipeHype": "images/emotes/PipeHype.png",
	"PogChamp": "images/emotes/PogChamp.png",
	"Poooound": "images/emotes/Poooound.png",
	"PraiseIt": "images/emotes/PraiseIt.png",
	"PunchTrees": "images/emotes/PunchTrees.png",
	"PuppeyFace": "images/emotes/PuppeyFace.png",
	"RaccAttack": "images/emotes/RaccAttack.png",
	"RalpherZ": "images/emotes/RalpherZ.png",
	"RedCoat": "images/emotes/RedCoat.png",
	"ResidentSleeper": "images/emotes/ResidentSleeper.png",
	"RitzMitz": "images/emotes/RitzMitz.png",
	"RuleFive": "images/emotes/RuleFive.png",
	"SMOrc": "images/emotes/SMOrc.png",
	"SMSkull": "images/emotes/SMSkull.png",
	"SSSsss": "images/emotes/SSSsss.png",
	"SeemsGood": "images/emotes/SeemsGood.png",
	"ShadyLulu": "images/emotes/ShadyLulu.png",
	"ShazBotstix": "images/emotes/ShazBotstix.png",
	"ShibeZ": "images/emotes/ShibeZ.png",
	"SoBayed": "images/emotes/SoBayed.png",
	"SoonerLater": "images/emotes/SoonerLater.png",
	"SriHead": "images/emotes/SriHead.png",
	"StoneLightning": "images/emotes/StoneLightning.png",
	"StrawBeary": "images/emotes/StrawBeary.png",
	"SuperVinlin": "images/emotes/SuperVinlin.png",
	"SwiftRage": "images/emotes/SwiftRage.png",
	"TF2John": "images/emotes/TF2John.png",
	"TTours": "images/emotes/TTours.png",
	"TheRinger": "images/emotes/TheRinger.png",
	"TheTarFu": "images/emotes/TheTarFu.png",
	"TheThing": "images/emotes/TheThing.png",
	"ThunBeast": "images/emotes/ThunBeast.png",
	"TinyFace": "images/emotes/TinyFace.png",
	"TooSpicy": "images/emotes/TooSpicy.png",
	"TriHard": "images/emotes/TriHard.png",
	"UleetBackup": "images/emotes/UleetBackup.png",
	"UnSane": "images/emotes/UnSane.png",
	"UncleNox": "images/emotes/UncleNox.png",
	"VaultBoy": "images/emotes/VaultBoy.png",
	"VoHiYo": "images/emotes/VoHiYo.png",
	"Volcania": "images/emotes/Volcania.png",
	"WTRuck": "images/emotes/WTRuck.png",
	"WholeWheat": "images/emotes/WholeWheat.png",
	"WinWaker": "images/emotes/WinWaker.png",
	"WutFace": "images/emotes/WutFace.png",
	"YouWHY": "images/emotes/YouWHY.png",
	"bleedPurple": "images/emotes/bleedPurple.png",
	"cmonBruh": "images/emotes/cmonBruh.png",
	"deExcite": "images/emotes/deExcite.png",
	"deIlluminati": "images/emotes/deIlluminati.png",
	"duDudu": "images/emotes/duDudu.png",
	"mcaT": "images/emotes/mcaT.png",
	"panicBasket": "images/emotes/panicBasket.png",
	"riPepperonis": "images/emotes/riPepperonis.png",
	"twitchRaid": "images/emotes/twitchRaid.png",
	"WillDraw4Rep": "images/emotes/WillDraw4Rep.png"
};

Chat.prototype.urlRegex = /(((http|ftp)s?):\/\/)?([\d\w]+\.)+[\d\w]{2,}(\/\S+)?/;
Chat.prototype.coordinateRegex = /(?:x:?\s*)?([-]?\d\d*)[,/.\sxy][\s*{0,4}]?[,/.\sxy]?(?:y:?\s*)?([-]?\d\d*)[y]?/gi
// \d\d* match atleast 1 number then every number right after that if they exists
// [,\sxX] match atleast one of the following: , or space or x or X
// [\s*{0,4}]? match 0 to 4 consequtive spaces if they exist
// matches:
// 4444x 5555y
// 4444X5555Y
// 4444, 5555
// 4444 5555
// 4444  5555
// (4444,5555)
// 4444 ,5555
// 4444.5555
// 4444/5555
// x223412 y21321
// 5555 , 55554
// x 123 y 123
// x: 555 y: 2222
// 1255y5242

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

		var messageContainsWord = (chatFilterByWordsArr[k].looseMatch) ? (message.toLowerCase().indexOf(chatFilterByWordsArr[k].inputText) !== -1) : (message.indexOf(chatFilterByWordsArr[k].inputText) !== -1)

		if (chatFilterByWordsArr[k].inputText.length > 1 && messageContainsWord) {
			messageDom.style.opacity = chatFilterByWordsArr[k].visibility * 0.01; // 100 to 1.0
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

Chat.prototype.addElementAsMessage = function addElementAsMessage (elem) {
	var max_scroll = Math.floor(this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height);
	var old_scroll = Math.ceil(this.messagesDom.scrollTop);
	
	var messageDom = this.messagesDom.appendChild(document.createElement("div"));
	messageDom.classList.add("chat-message");

	messageDom.appendChild(elem);

	if (max_scroll - elem.getBoundingClientRect().height <= old_scroll) { // is scrolled all the way down minus elem height
		this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
	}
};

Chat.prototype.addMessageToDom = function addMessageToDom (messageDom, message) {
	message = message.replace(this.coordinateRegex, " $1,$2 "); // removes spaces from between coordinates so it can be split below
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
			console.log(messages[k]);
			messageDom.appendChild(this.createCoordinate(messages[k].coordinate, messages[k].x, messages[k].y));
			messageDom.appendChild(document.createTextNode('\u00A0')); //&nbsp
			continue;
		}

		messageDom.appendChild(document.createTextNode(messages[k] + " "));
	}

	if (max_scroll - messageDom.getBoundingClientRect().height * 2 <= old_scroll ) {//scrolled all the way down minus new message * 2 to account for margins
		this.messagesDom.scrollTop = this.messagesDom.scrollHeight - this.messagesDom.getBoundingClientRect().height;
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
		console.log(x,y);
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
