function Mods (drawTogetherController) {
  this.drawTogetherController = drawTogetherController;
  this.BASE_MOD = "// Here you can write the javascript for your mod\n";
  this.BASE_MOD += "// You can find an example below\n";
  this.BASE_MOD += "\n";
  this.BASE_MOD += "anondraw.collab.chat.addMessage(\"Yay the mod loaded successfully!\");";
}

var exampleMods = [{
  id: 1,
  creator: "L",
  name: "testmod",
  verified: false,
  created: new Date(),
  lastupdated: new Date()
},
];

Mods.prototype.openModWindow = function openModWindow () {
  var modsWindow = this.drawTogetherController.gui.createWindow({
    title: "Client mods"
    
  });
  
  var content = modsWindow.appendChild(document.createElement("div"));
	content.className = "content";
  
  var button = content.appendChild(document.createElement("div"));
	button.classList = "drawtogether-button";
	button.appendChild(document.createTextNode("Currently active"));
	button.addEventListener("click", function () {
		//this.something();
	}.bind(this));
  
  var button = content.appendChild(document.createElement("div"));
	button.classList = "drawtogether-button";
	button.appendChild(document.createTextNode("Find new mod"));
	button.addEventListener("click", function () {
		//this.something();
	}.bind(this));
  
  var button = content.appendChild(document.createElement("div"));
	button.classList = "drawtogether-button";
	button.appendChild(document.createTextNode("Create new mod"));
	button.addEventListener("click", function () {
		this.openCreateModWindow();
	}.bind(this));
};

Mods.prototype.openCreateModWindow = function openCreateModWindow () {
  var modsWindow = this.drawTogetherController.gui.createWindow({
    title: "Create a new mod"
  });
  modsWindow.classList.add("createModWindow");
  
  var content = modsWindow.appendChild(document.createElement("div"));
	content.className = "content";

  var title = content.appendChild(document.createElement("h2"));
  title.appendChild(document.createTextNode("Create or update a mod"));
  
  var helpText = content.appendChild(document.createElement("h3"));
  helpText.appendChild(document.createTextNode("Tip: do not use this to code, but use something like notepad++ and just paste it in here so you don't accidently lose a lot of work"));
  
  var textarea = content.appendChild(document.createElement("textarea"));
  textarea.value = this.BASE_MOD;
  
  content.appendChild(document.createElement("br"));
  content.appendChild(document.createElement("br"));
  
  var checkbox = content.appendChild(document.createElement("input"));
  checkbox.type = "checkbox";
  checkbox.name = "update_mod_checkbox";
  checkbox.id = "update_mod_checkbox";
  
  var label = content.appendChild(document.createElement("label"));
  label.appendChild(document.createTextNode("This is an update for: "));
  label.for = "update_mod_checkbox";
  
  var updateModSelection = content.appendChild(this.createSelection(["Testmod", "Supermod"]));  
  content.appendChild(document.createTextNode(" with a "));
  var versionSelection = content.appendChild(this.createSelection(["major change", "minor change", "bugfix"], 1));
  content.appendChild(document.createElement("br"));
  
  var patchNotesTitle = content.appendChild(document.createElement("h4"));
  patchNotesTitle.appendChild(document.createTextNode("Patch notes"));
  var patchNotes = content.appendChild(document.createElement("textarea"));
  patchNotes.classList.add("patchnotes");
  content.appendChild(document.createElement("br"));
  
  var modNameTitle = content.appendChild(document.createElement("h4"));
  modNameTitle.appendChild(document.createTextNode("Mod name"));
  var modName = content.appendChild(document.createElement("input"));
  modName.classList.add("modName");
  content.appendChild(document.createElement("br"));
  
  var descriptionTitle = content.appendChild(document.createElement("h4"));
  descriptionTitle.appendChild(document.createTextNode("Mod description"));
  var description = content.appendChild(document.createElement("textarea"));
  description.classList.add("description");
  content.appendChild(document.createElement("br"));
  
  updateModSelection.disabled = true;
  versionSelection.disabled = true;
  patchNotes.disabled = true;
  checkbox.addEventListener("change", function () {
    updateModSelection.disabled = !checkbox.checked;
    versionSelection.disabled = !checkbox.checked;
    patchNotes.disabled = !checkbox.checked;
    
    modName.disabled = checkbox.checked;
    description.disabled = checkbox.checked;
  });

  content.appendChild(this.createButton("Test mod", function () {
    eval(textarea.value);
  }.bind(this)));
  
  content.appendChild(this.createButton("Submit mod", function () {
    //this.submitMod();
  }.bind(this)));
};

Mods.prototype.createButton = function createButton (text, callback) {
  var button = document.createElement("div");
	button.classList = "drawtogether-button";
	button.appendChild(document.createTextNode(text));
  button.addEventListener("click", callback);
  return button;
};

Mods.prototype.createSelection = function createSelection (options, defaultOption) {
  var selectInput = document.createElement("select");
  
  for (var k = 0; k < options.length; k++) {
    var option = document.createElement("option");
    option.value = options[k];
    option.appendChild(document.createTextNode(options[k]));
    selectInput.add(option);
  }
  
  if (defaultOption) selectInput.selectedIndex = defaultOption;
  
  return selectInput;
};

Mods.prototype.createVersionSelection = function createVersionSelection () {
  var hundredArray = [];
  for (var i = 0; i < 100; i++) hundredArray.push(i);
  
  var selection = document.createElement("span");
  
  var major = selection.appendChild(this.createSelection(hundredArray));
  selection.appendChild(document.createTextNode("."));
  var minor = selection.appendChild(this.createSelection(hundredArray));
  selection.appendChild(document.createTextNode("."));
  var patch = selection.appendChild(this.createSelection(hundredArray));
  
  selection.major = major;
  selection.minor = minor;
  selection.patch = patch;
  
  return selection;
};

Mods.prototype.loadMod = function loadMod (mod) {
  
};
