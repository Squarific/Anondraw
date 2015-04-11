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
	var promptContent = promptContainer.appendChild(document.createElement("div"));
	var questionDom = promptContent.appendChild(document.createElement("span"));
	var answers = promptContent.appendChild(document.createElement("div"));

	promptContainer.className = "gui-prompt-container";
	promptContent.className = "gui-prompt-content";
	questionDom.className = "gui-prompt-question";
	answers.className = "gui-prompt-answers";

	questionDom.innerText = question;
	questionDom.textContent = question;

	if (options == "freepick") {
		var freepick = answers.appendChild(document.createElement("input"));
		freepick.className = "gui-prompt-freepick-input";
		freepick.placeholder = question;

		freepick.addEventListener("keypress", function (event) {
			if (event.keyCode == 13) {
				this.container.removeChild(promptContainer);
				callback(freepick.value);
			}
		}.bind(this));

		var freepickButton = answers.appendChild(document.createElement("div"));
		freepickButton.className = "gui-prompt-button gui-prompt-freepick-button";

		freepickButton.innerText = "Submit";
		freepickButton.textContent = "Submit";

		freepickButton.addEventListener("click", function (event) {
			this.container.removeChild(promptContainer);
			callback(freepick.value);
		}.bind(this));
	}

	if (typeof options == "object" && typeof options.length == "number") {
		for (var k = 0; k < options.length; k++) {
			var optionButton = answers.appendChild(document.createElement("div"));
			optionButton.className = "gui-prompt-button gui-prompt-option-button";

			optionButton.innerText = options[k];
			optionButton.textContent = options[k];
			optionButton.option = options[k];

			optionButton.addEventListener("click", function (event) {
				this.container.removeChild(promptContainer);
				callback(event.target.option);
			}.bind(this));
		}
	}
};