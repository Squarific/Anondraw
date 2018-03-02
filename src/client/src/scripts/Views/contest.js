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

Anondraw.prototype.view.contest.createInfo = function createContestInfo () {
	var feature = document.createElement("div");
	feature.className = "feature-container";
	
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
	
	var p = div.appendChild(document.createElement("p"));
	p.className = "feature-text";
	p.appendChild(document.createTextNode("This month's theme is: "));
	
	var strong = p.appendChild(document.createElement("strong"));
	strong.appendChild(document.createTextNode("space"));
	
	p.appendChild(document.createElement("br"));
	
	p.appendChild(document.createTextNode("Submission period ends: "));

	var strong = p.appendChild(document.createElement("strong"));
	strong.appendChild(document.createTextNode("March 21, 2018"));

	div.appendChild(document.createElement("br"));
	
	var tryButton = div.appendChild(document.createElement("a"));
	tryButton.className = "button trybutton";
	tryButton.appendChild(document.createTextNode("Go to the collab tool to participate"));
	tryButton.href = "/collab";
	tryButton.setAttribute("data-navigo", "");
	
	return feature;
};

Anondraw.prototype.winners = [
	{
		title: "March 2018 Winners (Placeholder/Example)",
		teams: [
			{
				name: "Meme team",
				members: [
					{ name: "A member"},
					{ name: "Anondraw", href: "https://www.twitch.com/anondraw"},
					{ name: "Someone"}
				],
				image: "2ysi1gvut5590xu5jjle8o8wi4juo5gu64jchbdnymim223j"
			},
			{
				name: "Dream team",
				members: [
					{ name: "Beauty"},
					{ name: "Beast"},
				],
				image: "k8d55r3tmampou546lkrkrbjj7uau2jpggtwh2ll2gxwsjkm"
			},
			{
				name: "The thirds",
				members: [
					{ name: "McQueen"},
					{ name: "Mickey Mouse", href: "https://www.twitch.com/anondraw"},
					{ name: "Rick", href: "https://www.anondraw.com"},
					{ name: "Morty"},
				],
				image: "fqgccopc5vb0uxjldpbtd004iganaqbd6t70gym3hrnavuhz"
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
	bigger.href = "http://anondraw.com/userimages/" + team.image + ".png";;
	bigger.target = "_blank";
	
	var img = bigger.appendChild(document.createElement("img"));
	img.src = "http://anondraw.com/userimages/" + team.image + ".png";
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
