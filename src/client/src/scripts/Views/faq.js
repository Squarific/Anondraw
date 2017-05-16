Anondraw.prototype.createFaqPage = function createFaqPage () {
	var container = document.createElement("div");
	
	container.appendChild(this.createTopBar());
	
	var faq = container.appendChild(document.createElement("div"));
	faq.className = "card faqcard";
	
	var questions = [{
		question: "What is anondraw?",
		answer: "It's a website where you can draw or doodle in group with friends or strangers. Join one of the rooms and start drawing and collaborating with the group. The interactive drawing works on the iPad and other android tablets. You can also doodle on phones."
	}, {
		question: "How do I chat?",
		answer: "There is a chat to the right or if you are on mobile you can click on the chat button."
	}, {
		question: "Can I make animations?",
		answer: 'Yes you can, for more info on how making these animations work, you can watch <a href="https://www.youtube.com/watch?v=wZ47oOPqNAQ">this video</a>'
	}, {
		question: "How big is the canvas?",
		answer: "The interactive canvas has an infinite size. You could move as far away from the center as you'd like."
	}, {
		question: "I want to draw privately with some people, is that possible?",
		answer: "Yes, in the home screen click on draw with friends and then share the invite url printed in the chat. If you are already in a room, simply click on the room button and then click create private room after giving it a name."
	},  {
		question: "How do you play the game?",
		answer: "It's a drawsomething pictionairy like game. You play the game by drawing the word you get. Then other people have to guess what you draw. The person that guessed the drawing and the drawer get a point."
	}, {
		question: "Why can't I draw? How do I regain Ink?",
		answer: "You probably don't have any ink left. You can get more ink by waiting 30 seconds. If you still don't get enough ink try making an account, the more reputation you have the more ink you get."
	}, {
		question: "What is that number with an R behind peoples names?",
		answer: "That is the amount of reputation someone has. The more they have the more benefits they get."
	}, {
		question: "What are those points behind some peoples names?",
		answer: "If you play the gamemode you can earn points by guessing what other people are drawing."
	}, {
		question: "Are 3d party programs allowed?",
		answer: 'They are as long as they are reasonable. So be cool about it. An example of drawing bots:' +
		        ' <a href="http://anonbots.bitballoon.com/" alt="Anondraw bot">http://anonbots.bitballoon.com</a>'
	}, {
		question: "What benefits does reputation give you?",
		answer: "At " + this.ZOOMED_OUT_MIN_REP + " reputation, you are allowed to draw while zoomed out. \n" +
		        "At " + this.BIG_BRUSH_MIN_REP + " reputation, you are allowed to use brush sizes bigger than 10. \n" +
		        "At 7 reputation, you can give upvotes to other people who have less reputation than you. \n" +
		        "At 15 reputation, you can join the member only rooms and share an ip with other users without affecting your ink. \n" +
		        "At " + this.KICKBAN_MIN_REP + "+ reputation, you can kickban people for a certain amount of time when they misbehave. \n "
	}, {
		question: "How do I get reputation?",
		answer: "Other people have to give you an upvote, every upvote is one reputation."
	}, {
		question: "Am I allowed to destroy doodles or drawings?",
		answer: "The goal is to let people draw together. You should never be afraid to help or change a drawing. However griefing on purpose is not allowed."
	}, {
		question: "I want to draw in group but I don't want people to destroy my drawing/doodle.",
		answer: "Move away from the center where there are less people then get some reputation from your drawings and use the member rooms."
	}, {
		question: "So this is basicly a ms paint multiplayer app?",
		answer: "You could call it that yea, it's a draw pad where you can draw something online."
	}, {
		question: "How long will my sketches be saved?",
		answer: "Your sketches should remain forever. All drawings are saved on the pads every 6 hours, after this period they should be permanent."
	}, {
		question: "Can I play this like draw something but online?",
		answer: "Yes, there is a gamemode where you get words and other people have to guess what you just drew."
	}, {
		question: "I'd like to donate, is that possible?",
		answer: "Yea it is, the best way would be to buy premium, that way you get something in return. If you feel like just throwing money in but don't want premium for some reaosn, you can also always use <a href=\"http://www.paypal.me/anondraw\">http://www.paypal.me/anondraw</a>"
	}];

	for (var qKey = 0; qKey < questions.length; qKey++) {
		var question = faq.appendChild(document.createElement("div"));
		question.className = "question-container";

		var qhead = question.appendChild(document.createElement("h2"));
		qhead.className = "question";
		qhead.innerHTML = questions[qKey].question;

		var qText = question.appendChild(document.createElement("div"));
		qText.className = "answer";
		
		var answerLines = questions[qKey].answer.split("\n");
		for (var k = 0; k < answerLines.length; k++) {
			var answerLine = qText.appendChild(document.createElement("div"));
			answerLine.innerHTML = answerLines[k];
		}
	}
	
	return container;
};