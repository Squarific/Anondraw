function Anondraw (container, settings) {
	this.settings = settings;
	
	this.container = container.appendChild(document.createElement("div"));
	this.container.className = "fillParent";
	
	this.pmContainer = container.appendChild(document.createElement("div"));
	this.pmContainer.className = "pmcontainer";
	
	this.account = new Account(this.settings.accountServer);
	
	this.account.isLoggedIn(function () {});
	this.messages = new Messages(this.settings.messageServer, this.account);
	this.privateChats = new PrivateChats(this.pmContainer, this.settings.privateChatServer, this.account, this.messages);
	
	var windowContainer = container.appendChild(document.createElement("div"));
	windowContainer.className = "windowcontainer";
	this.gui = new Gui(windowContainer);

	this.collabInitDone = false;
	this.collabContainer;
	this.collab;
	
	this.createSideMenu();
	this.createRouter();
}

Anondraw.prototype.createSideMenu = function createSideMenu () {
	this.sideMenu = new SideMenu([
		{
			icon: "home",
			text: "Home",
			href: "/",
			navigo: true
		},
		{
			icon: "paint-brush",
			text: "Collaboration",
			href: "/collab",
			navigo: true
		},
		{
			icon: "user",
			text: "My profile",
			href: "/profile",
			navigo: true
		},
		{
			icon: "commenting",
			text: "Private Messages",
			href: "/messages",
			navigo: true
		},
		{
			icon: "th",
			text: "Gallery",
			href: "/gallery",
			navigo: true
		},
		{
			icon: "question-circle",
			text: "FAQ",
			href: "/faq",
			navigo: true
		},
		{
			icon: "bullhorn",
			text: "Feedback",
			href: "javascript:MyOtziv.mo_show_box(); ga('send', 'event', 'feedback', 'open');;"
		},
		{
			icon: "github",
			text: "Github",
			href: "javascript:window.open('https://github.com/Squarific/anondraw');ga('send', 'event', 'githubmain', 'open');;",
		},
		{
			icon: "power-off",
			text: "Logout",
			href: "/logout",
			navigo: true
		}
	], this.container);
};

Anondraw.prototype.createRouter = function createRouter () {
	this.router = new Navigo();
	
	this.router
	.on('/collab*', function () {	
		this.initCollab();
		ga('set', 'page', '/collab');
		ga('send', 'pageview');
		this.setContent(this.collabContainer);
		this.collab.createAccountWindow(); // Dirty quick fix for syncing account status
		if (this.collab.network.socket) this.collab.network.socket.emit("uKey", this.account.uKey);
		this.collab.paint.resize();
		this.collab.chat.scrollChat();
	}.bind(this))
	.on('/messages/:id/:username', function (params) {
		this.setContent(this.createMessagePage(params));
		ga('set', 'page', '/messages/send');
		ga('send', 'pageview');
	}.bind(this))
	.on('/messages*', function () {
		this.setContent(document.createTextNode("Loading..."));	
		this.account.checkLogin(function (err, loggedIn) {
			if (loggedIn) {
				this.setContent(this.createMessagePage());
				return;
			}
			
			this.router.navigate("/login");
		}.bind(this));
		
		ga('set', 'page', '/messages');
		ga('send', 'pageview');
	}.bind(this))
	.on('/feed*', function () {
		this.setContent(document.createTextNode("Feed"));
		ga('set', 'page', '/feed');
		ga('send', 'pageview');
	}.bind(this))
	.on('/login*', function () {
		this.setContent(document.createTextNode("Loading..."));	
		this.account.checkLogin(function (err, loggedIn) {
			if (loggedIn) {
				ga('set', 'page', '/alreadyLoggedIn');
				ga('send', 'pageview');
				this.router.navigate("/collab");
				return;
			}
			
			this.setContent(this.createLoginPage());
		}.bind(this));
		ga('set', 'page', '/login');
		ga('send', 'pageview');
	}.bind(this))
	.on('/forgot*', function () {
		this.setContent(document.createTextNode("Loading..."));	
		this.account.checkLogin(function (err, loggedIn) {
			if (loggedIn) {
				ga('set', 'page', '/alreadyLoggedIn');
				ga('send', 'pageview');
				this.router.navigate("/collab");
				return;
			}
			
			this.setContent(this.createForgotPage());
		}.bind(this));
		ga('set', 'page', '/forgot');
		ga('send', 'pageview');
	}.bind(this))
	.on('/reset*', function () {
		this.setContent(document.createTextNode("Loading..."));	
		this.account.checkLogin(function (err, loggedIn) {
			if (loggedIn) {
				ga('set', 'page', '/alreadyLoggedIn');
				ga('send', 'pageview');
				this.router.navigate("/collab");
				return;
			}
			
			this.setContent(this.createResetPage());
		}.bind(this));
		ga('set', 'page', '/reset');
		ga('send', 'pageview');
	}.bind(this))
	.on('/register*', function () {
		this.setContent(document.createTextNode("Loading..."));	
		this.account.checkLogin(function (err, loggedIn) {
			if (loggedIn) {
				ga('set', 'page', '/alreadyLoggedIn');
				ga('send', 'pageview');
				this.router.navigate("/collab");
				return;
			}
			
			this.setContent(this.createRegisterPage());
			ga('set', 'page', '/register');
			ga('send', 'pageview');
		}.bind(this));
	}.bind(this))
	.on('/logout', function () {
		this.setContent(this.createLogoutPage());
			ga('set', 'page', '/logout');
			ga('send', 'pageview');
	}.bind(this))
	.on('/settings*', function () {
		this.setContent(document.createTextNode("Settings"));
		ga('set', 'page', '/settings');
		ga('send', 'pageview');
	}.bind(this))
	.on('/faq*', function () {
		this.setContent(this.createFaqPage());
		ga('set', 'page', '/faq');
		ga('send', 'pageview');
	}.bind(this))
	.on('/gallery*', function () {
		this.setContent(this.createPublicFeed());
		ga('set', 'page', '/gallery');
		ga('send', 'pageview');
	}.bind(this))
	.on('/profile/:id', function (params) {
		this.setContent(this.createProfilePage(params.id));
		ga('set', 'page', '/profile');
		ga('send', 'pageview');
	}.bind(this))
	.on('/profile*', function () {
		this.setContent(document.createTextNode("Loading..."));	
		this.account.checkLogin(function (err, loggedIn) {
			if (loggedIn) {
				this.router.navigate('/profile/' + this.account.id);
				return;
			}
			
			this.router.navigate("/login");
		}.bind(this));
		
		ga('set', 'page', '/myprofile');
		ga('send', 'pageview');
	}.bind(this))
	.on('/new*', function () {
		this.router.navigate("/collab");
		ga('set', 'page', '/new');
		ga('send', 'pageview');
	}.bind(this))
	.on(function () {
		/* If there is a hash, go to the collab app for legacy support */
		if (location.hash && location.hash.indexOf("pw_adbox") == -1) {
			location = location.origin + "/collab" + location.hash;
			return;
		}
		
		if (false) this.router.navigate("/feed");
		else this.setContent(this.createHome());
		
		ga('set', 'page', '/');
		ga('send', 'pageview');
	}.bind(this))
	.notFound(function (query) {
		console.log(query);
		this.setContent(document.createTextNode("This page does not seem to exist. Did you type it wrong? If not, contact info@anondraw.com"));
		ga('set', 'page', '/notfound');
		ga('send', 'pageview');
	}.bind(this));
	
	this.router.updatePageLinks();
	this.router.resolve();
};

Anondraw.prototype.initCollab = function initCollab () {
	if (this.collabInitDone) return;
	this.collabInitDone = true;
	
	// Draw and paint online
	var urlInfo = location.hash.substr(1, location.hash.length).split(",");

	var room = urlInfo[0];
	var x = parseInt(urlInfo[1]);
	var y = parseInt(urlInfo[2]);
	
	var settings = {
		loadbalancer: this.settings.loadbalancer,
		imageServer: this.settings.imageServer,
		accountServer: this.settings.accountServer,
		room: room || "main",
		mode: (room) ? "join" : "ask",
		leftTopX: x || 0,
		leftTopY: y || 0
	};

	this.collabContainer = document.createElement("div");
	this.collabContainer.className = "collab-container";

	this.collab = new DrawTogether(this.collabContainer, settings, this.settings.emotesHash, this.account, this.router, this.privateChats);
};

Anondraw.prototype.setContent = function setContent (domNode) {
	while (this.sideMenu.content.firstChild)
		this.sideMenu.content.removeChild(this.sideMenu.content.firstChild);
	
	this.sideMenu.content.appendChild(domNode);
	this.router.updatePageLinks();
	pw_load ? pw_load() : "";
};