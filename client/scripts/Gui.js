function Gui (container) {
	this.container = container;
}

Gui.prototype.prompt = function prompt (question, options, callback) {
	// Asks a question to the user giving him the options
	// if options is an array of strings e.g. ["yes", "no"] then the options will be buttons
	// if options is the string 'freepick', the option is a text box
	// if no options are provided but is instead a function, it will be treated as the callback
	// additionally it will be defaulted to a text box

	if (typeof options == "function") {
		callback = options;
		options = "freepick";
	}

	callback = typeof callback == "function" ? callback : function () {};

	var promptContainer = this.container.appendChild(document.createElement("div"));
	var question = promptContainer.appendChild(document.createElement("span"));
	var answers = promptContainer.appendChild(document.createElement("div"));

	promptContainer.className = "gui-prompt-container";
	question.className = "gui-prompt-question";
	answers.className = "gui-prompt-answers";

	question.innerText = question;
	question.textContent = question;
};