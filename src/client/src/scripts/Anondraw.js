function Anondraw (container, settings) {
	this.settings = settings;
	this.container = container;
	this.account = new Account(this.settings.accountServer);
	this.messages = new Messages(this.settings.messageServer, this.account);

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
			icon: "commenting",
			text: "Private Messages",
			href: "/messages",
			navigo: true
		},
		{
			icon: "bullhorn",
			text: "Feedback",
			href: "javascript:MyOtziv.mo_show_box();"
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
		this.setContent(this.collabContainer);
		this.collab.paint.resize();
	}.bind(this))
	.on('/messages*', function () {
		this.setContent(this.createMessagePage());
	}.bind(this))
	.on('/feed*', function () {
		this.setContent(document.createTextNode("Feed"));
	}.bind(this))
	.on('/login*', function () {
		this.setContent(this.createLoginPage());
	}.bind(this))
	.on('/register*', function () {
		this.setContent(this.createRegisterPage());
	}.bind(this))
	.on('/logout', function () {
		this.setContent(this.createLogoutPage());
	}.bind(this))
	.on('/settings*', function () {
		this.setContent(document.createTextNode("Settings"));
	}.bind(this))
	.on('/new*', function () {
		this.router.navigate("/collab");
	}.bind(this))
	.on(function () {
		/* If there is a hash, go to the collab app for legacy support */
		if (location.hash) location = "collab/" + location.hash;
		
		if (false) this.router.navigate("/feed");
		else this.setContent(this.createHome());
	}.bind(this))
	.notFound(function (query) {
		console.log(query);
		this.setContent(document.createTextNode("This page could not be found ;("));
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

	this.collab = new DrawTogether(this.collabContainer, settings, this.settings.emotesHash, this.account);
};

Anondraw.prototype.setContent = function setContent (domNode) {
	while (this.sideMenu.content.firstChild)
		this.sideMenu.content.removeChild(this.sideMenu.content.firstChild);
	
	this.sideMenu.content.appendChild(domNode);
	this.router.updatePageLinks();
};