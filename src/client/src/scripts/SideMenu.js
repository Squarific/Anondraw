/*
	Creates a menu and a target region in which it shows the pages
	You may use the sidemenu.content to display content
*/

function SideMenu (menuItems, container) {
	this.container = container;
	this.menuItems = menuItems;
	this.setupDom();
}

SideMenu.prototype.setupDom = function setupDom() {
	while (this.container.firstChild)
		this.container.removeChild(this.container.firstChild);
	
	this.container.appendChild(this.createMenu());
	this.container.appendChild(this.createTarget());
};

/*
	Returns a menu dom node, bound to this side menu
	Replaces the previous menu
*/
SideMenu.prototype.createMenu = function createMenu () {
	var div = document.createElement("div");
	div.className = "menu";
	
	for (var k = 0; k < this.menuItems.length; k++) {
		var menuItem = div.appendChild(document.createElement("a"));
		menuItem.className = "menuItem";
		menuItem.href = this.menuItems[k].href;
		this.menuItems[k].navigo ? menuItem.setAttribute("data-navigo", "") : "";
		
		var menuIcon = menuItem.appendChild(document.createElement("i"));
		menuIcon.className = "menuIcon fa fa-" + this.menuItems[k].icon;
		menuIcon.setAttribute("aria-hidden", true);
		
		var menuText = menuItem.appendChild(document.createElement("span"));
		menuText.className = "menuText";
		menuText.innerHTML = this.menuItems[k].text;
	}
	
	return div;
};

/*
	Returns a target dom node, bound to this side menu
	Replaces the previous target area
*/
SideMenu.prototype.createTarget = function createTarget () {
	var div = document.createElement("div");
	div.className = "content-container";
	
	this.content = div;
	
	return div;
};