//https://github.com/jakubknejzlik/node-timeout-callback
function timeoutCallback(callback,timeout,ctx){
	var called = false;	
	var interval = setTimeout(function(){
		if(called)return;
			called = true;
		this.last_error_timestamp = (typeof this.last_error_timestamp === 'undefined') ? 0 : this.last_error_timestamp; // set temporary variable in drawTogether's context
		var curr_time = Date.now();
		if(curr_time - this.last_error_timestamp > 5000){
			this.chat.addMessage("Websocket Timeout! Refresh the webpage. Kappa");
			this.last_error_timestamp = curr_time;
		}
		
		callback.apply(this,[false]);
	}.bind(ctx),timeout); 

    return function(){
        if(called)return;
        called = true;
        clearTimeout(interval);
        callback.apply(this,arguments);
    }
}
