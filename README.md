DrawTogether2
=============

Source code of http://www.squarific.com/drawtogether2/

How to embed on your website
============================

##The client

###Simple
Copy paste the following code where you want the app:

    <script src="//www.squarific.com/drawtogether2/DrawTogether.embed.min.js"></script>
    <div id="drawtogether2" style="min-height:250px;"></div>
    <script>
    	var container = document.getElementById("drawtogether2");
        var drawtogether2 = new DrawTogether(container, {
        	server: "http://drawtogether.squarific.com",
        	room: "main"
        });
    </script>

###Advanced

##The server (if you don't want to use the public server)

How to help
===========
