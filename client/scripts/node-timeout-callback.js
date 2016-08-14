//https://github.com/jakubknejzlik/node-timeout-callback
function timeoutCallback(timeout,callback){
	
	//

	var called = false;
	if(typeof timeout === 'function'){// if timeCallback is called with only a function and no specific timeout time
		callback = timeout; 
		timeout = 10*1000; // default 10 seconds
	}
	
	var interval = setTimeout(function(){
		if(called)return;
			called = true;
		this.last_error_timestamp = (typeof this.last_error_timestamp === 'undefined') ? 0 : this.last_error_timestamp; // set temporary variable in drawTogether's context
		var curr_time = Date.now();
		if(curr_time - this.last_error_timestamp > 5000){
			this.chat.addMessage("Websocket Timeout! Refresh the webpage. Kappa");
			this.last_error_timestamp = curr_time;
		}
		
		callback(false);
	}.bind(drawTogether),timeout); 

    return function(){
        if(called)return;
        called = true;
        clearTimeout(interval); // release setTimeout variable 
        callback.apply(this,arguments);
    }
}
