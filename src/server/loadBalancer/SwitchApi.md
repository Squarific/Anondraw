# Switch api

## Query to find a server

Get the player with the most players that has open slots.

Send an http request to /getserver

Returns {"error": "No server available!"} if no server could be found.    
Returns {"server": "ip:port"} on successs.

You should update the player count every time it changes and at least once every 120 seconds.

## Register a server

Register your server to get players.

Send an http request to /register?key=JOINKEY&ip=YOURIP&port=YOURPORT

Returns {"error": "example error message"} on failure.    
Returns {"success": "Registered", "id": "SOMEID"} on success.

You should remember the id as it will be used for the other commands.

## Update

Update the playercount

Send an http request to /update?id=YOURID&players=PLAYERCOUNT

Returns {"error", "No server with this id"} if the provided id does not exist.    
Returns {"success": "Player count updated"} on success.