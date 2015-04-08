var basex = 200;
var basey = 200;
 
var img;
var x = 0;
var y = 0;
 
var canvas = document.createElement("canvas");
var context;
 
var intervalId;
 
function draw() {
        var pixel = context.getImageData(x, y, 1, 1).data;
        var hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
       
        drawTogether.socket.emit("drawing", [0, x + basex, y + basey, 1, hex, x + basex, y + basey]);
       
        x++;
        if (x == canvas.width) { x = 0; y++; }
        if (y == canvas.height) clearInterval(intervalId);
}
function start() {
        var base64 = prompt("base64", "data:image/jpg;base64,");
       
        x = 0;
        y = 0;
       
        img = new Image();
        img.src = base64;
        img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                context = canvas.getContext("2d");
               
                context.drawImage(img, 0, 0, canvas.width, canvas.height)
               
                intervalId = setInterval(draw, 1);
        };
        img.onerror = function() { alert("error"); };
}
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}