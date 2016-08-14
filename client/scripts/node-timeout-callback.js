//https://github.com/jakubknejzlik/node-timeout-callback

// This function will make sure a callback you suply to a library
// will be called once at all time
// Not more, nor less. You provide a timeout and after that timeout
// your callback will be called

// Callback: function
// timeout: How long we wait in miliseconds for the library to respond

// ctx: the this value for when the library failed
// arguments: an array of arguments for when the library failed

function timeoutCallback(callback, timeout, ctx, arguments){
	var called = false;
	var interval = setTimeout(function(){
		if(called)return;
		called = true;		
		callback.apply(ctx, arguments);
	}.bind(ctx),timeout); 

    return function(){
        if(called)return;
        called = true;
        clearTimeout(interval);
        callback.apply(this, arguments);
    }
}
