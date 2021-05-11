Anondraw.prototype.createContestFeed = function createContestFeed () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	container.appendChild(this.view.contest.createInfo());
	
	for (var k = 0; k < this.winners.length; k++) {
		container.appendChild(this.view.contest.createWinners(this.winners[k]));
	}
	
	return container;
};

Anondraw.prototype.view.contest = {};

Anondraw.prototype.view.contest.createTutorial = function createTutorial () {
	var steps = [{
		image: "tool.png",
		text: "Use the select tool."
	}, {
		image: "select.png",
		text: "Select drawing."
	}, {
		image: "options.png",
		text: "Click 'Enter the contest'"
	}, {
		image: "details.png",
		text: "Enter your teams details."
	}];
	
	var div = document.createElement("div");
	div.className = "contest-tutorial";

	for (var k = 0; k < steps.length; k++) {
		var p = div.appendChild(document.createElement("p"));
		p.className = "feature-text";
	
		var img = p.appendChild(document.createElement("img"));
		img.src = "images/contesttutorial/" + steps[k].image;

		p.appendChild(document.createTextNode(steps[k].text));
	}
	
	return div;
};

Anondraw.prototype.view.contest.createInfo = function createContestInfo () {
	var feature = document.createElement("div");
	feature.className = "feature-container contest-info";
	
	var div = feature.appendChild(document.createElement("div"));
	div.className = "feature-text-container";
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("Monthly Collab Contest"));
	
	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("The first of each month we will announce a theme. Teams of at least 2 people can then use the collab tool to create a drawing for the given theme. On the 21st of each month the voting period starts."));
	
	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("All registered users will be able to vote, except on their own drawing, weighted with their reputation. A week later the winner will be announced."));	
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("How to enter"));
	
	div.appendChild(this.createTutorial());
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode("Current theme"));
	
	div.appendChild(document.createElement("br"));

	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("This month's theme is: "));
	
	var strong = p.appendChild(document.createElement("strong"));
	strong.appendChild(document.createTextNode("medieval"));
	
	p.appendChild(document.createElement("br"));
	
	p.appendChild(document.createTextNode("Submission period ends: "));

	var strong = p.appendChild(document.createElement("strong"));
	strong.appendChild(document.createTextNode("May 21, 2018"));

	div.appendChild(document.createElement("br"));
	
	var joinButton = div.appendChild(document.createElement("a"));
	joinButton.className = "button trybutton";
	joinButton.appendChild(document.createTextNode("Go to the collab tool to participate"));
	joinButton.href = "/collab";
	joinButton.setAttribute("data-navigo", "");
	
	var voteButton = div.appendChild(document.createElement("a"));
	voteButton.className = "button secondary";
	voteButton.appendChild(document.createTextNode("Vote for this months entries"));
	voteButton.href = "/vote";
	voteButton.setAttribute("data-navigo", "");
	
	
	return feature;
};

Anondraw.prototype.winners = [
	{
		title: "April 2018 Winners",
		month: 4,
		year: 2018,
		teams: [
			{
				name: "",
				members: [
					{ name: "PauPau", href: "http://www.anondraw.com/profile/25956"},
					{ name: "Zurg"}
				],
				image: "mt55j92aru800znj85q2ap926s1yduoov9k3qn8pe8i18yi8"
			},
			{
				name: "",
				members: [
					{ name: "marmar"},
					{ name: "JT Hornsby"},
					{ name: "Terri"}
				],
				image: "jrnknfcy8bayk0sz73ssf33mecvhcl3pf35t6leiiezvmgwl"
			},
			{
				name: "",
				members: [
					{ name: "IceWallow__Come", href: "https://www.instagram.com/sirshredder/"}
				],
				image: "xticuerlpzy6c5df2h6qzgrpsxp3ecmthk0d0b0hii2bn7xb"
			}
		]
	},
	{
		title: "March 2018 Winners",
		month: 3,
		year: 2018,
		teams: [
			{
				name: "",
				members: [
					{ name: "Coferosa"},
					{ name: "Cherry Bear"},
					{ name: "cat meow"}
				],
				image: "v1z17x6cfhnykjetnqv82jrisnmrls1xu80g1249wtpaqqlj"
			},
			{
				name: "",
				members: [
					{ name: "electric int"},
					{ name: "killjoy"}
				],
				image: "lvq0l3qll00ybpfucdx9hr5ad8f4vi4lcovqt2pz841e4orx"
			},
			{
				name: "",
				members: [
					{ name: "Shred", href: "https://www.instagram.com/sirshredder/"}
				],
				image: "xa449ptolxpem5d82zng57vnx6gwvot37s6vl8nq951eypt2"
			}
		]
	}
];


Anondraw.prototype.view.contest.createWinners = function contestCreateWinners (winners) {
	var feature = document.createElement("div");
	feature.className = "feature-container";
	
	var div = feature.appendChild(document.createElement("div"));
	div.className = "feature-text-container winners-container";
	
	
	var h2 = div.appendChild(document.createElement("h2"));
	h2.appendChild(document.createTextNode(winners.title));
	
	div.appendChild(this.createPodium(winners.teams));
	
	var allButton = div.appendChild(document.createElement("a"));
	allButton.className = "button secondary";
	var months = ["January", "February", "March", "April", "May", "June", "July", "Augustus", "September", "October", "November", "December"];
	allButton.appendChild(document.createTextNode("See all entries for " + months[winners.month - 1] + " " + winners.year));
	allButton.href = "/allentries/" + winners.month + "/" + winners.year;
	allButton.setAttribute("data-navigo", "");
	
	return feature;
};


Anondraw.prototype.view.contest.createPodium = function createPodium (teams) {
	var podium = document.createElement("div");
	podium.className = "podium";
	
	for (var k = 0; k < teams.length; k++) {
		podium.appendChild(this.createWinner(k + 1, teams[k]));
	}
	
	return podium;
};

Anondraw.prototype.view.contest.createWinner = function createWinner (place, team) {
	var container = document.createElement("div");
	container.className = "team";
	
	var classes = ["first", "second", "third"];
	
	var bigger = container.appendChild(document.createElement("a"));
	bigger.href = "https://www.anondraw.com/userimages/" + team.image + ".png";;
	bigger.target = "_blank";
	
	var img = bigger.appendChild(document.createElement("img"));
	img.src = "https://www.anondraw.com/userimages/" + team.image + ".png";
	img.className = classes[place - 1];
	
	var podiumPiece = container.appendChild(document.createElement("div"));
	podiumPiece.className = "piece " + classes[place - 1];
	podiumPiece.appendChild(document.createTextNode(place.toString()));
	
	var name = container.appendChild(document.createElement("span"));
	name.appendChild(document.createTextNode(team.name));
	name.className = "name";
	
	for (var k = 0; k < team.members.length; k++) {
		var name = container.appendChild(document.createElement("a"));
		var last = k == (team.members.length - 1);
		name.appendChild(document.createTextNode(team.members[k].name + (last ? "" : ", ")));
		name.className = "member";
		
		if (team.members[k].href) name.href = team.members[k].href;
		name.target = "_blank";
	}
	
	return container;
};
