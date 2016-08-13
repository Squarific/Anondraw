//https://github.com/jakubknejzlik/node-timeout-callback
function timeoutCallback(timeout,callback){

    var called = false;
    if(typeof timeout === 'function'){// if timeCallback is called with only a function and no specific timeout time
        callback = timeout; 
        timeout = 10*1000; // default 10 seconds
    }

    var interval = setTimeout(function(){
        if(called)return;
        called = true;
	drawTogether.chat.addMessage("Websocket Timeout! Refresh the webpage.");
        callback(false);
    },timeout); 

    return function(){
        if(called)return;
        called = true;
        clearTimeout(interval); // release setTimeout variable 
        callback.apply(this,arguments);
    }
}
