echo Password file creation script...

echo Would you like to continue? y/n

read allCool

if [ "$allCool" = "y" ]; then
	echo enter mysql password: 
	read mysqlp
	
	echo module.exports = $mysqlp\; | tee server/playerServer/mysql_password.js

	echo enter password for everything else: 
	read password

	echo module.exports = $password\; | tee server/imageServer/draw_password.js server/playerServer/status_password.js server/playerServer/kickban_password.js server/realTime/draw_password.js server/realTime/scripts/kickban_password.js server/realTime/join_code_password.js server/realTime/imgur_password.js server/loadBalancer/status_password.js server/loadBalancer/join_code_password.js
fi

#./server/imageServer/draw_password.js
#./server/playerServer/status_password.js
#./server/playerServer/kickban_password.js
#./server/playerServer/mysql_password.js
#./server/realTime/draw_password.js
#./server/realTime/scripts/kickban_password.js
#./server/realTime/join_code_password.js
#./server/realTime/imgur_password.js
#./server/loadBalancer/status_password.js
#./server/loadBalancer/join_code_password.js