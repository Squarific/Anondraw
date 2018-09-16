(function() {
    /*
        var setZeroTimeout = function(t) {
            if (t.postMessage) {
                var e = [],
                    s = "asc0tmot",
                    a = function(t) {
                        e.push(t), postMessage(s, "*")
                    },
                    n = function(a) {
                        if (a.source == t && a.data == s) {
                            if (a.stopPropagation && a.stopPropagation(), e.length) try {
                                e.shift()()
                            } catch (t) {
                                setTimeout((n = t, function() {
                                    throw n.stack || n
                                }), 0)
                            }
                            e.length && postMessage(s, "*")
                        }
                        var n
                    };
                if (t.addEventListener) return addEventListener("message", n, !0), a;
                if (t.attachEvent) return attachEvent("onmessage", n), a
            }
            return setTimeout
        }(window);
    */
    const globalA = 1,
        DRAW_DELAY = false;

    var cursorDown = false;

    function curDown() {
        cursorDown = true;
        anondraw.collab.paint.addUserPath()
    }

    function curPoint(x, y) {
        if (!anondraw.collab.paint.localUserPaths.length) curDown();
        x += 0.5;
        y += 0.5;
        anondraw.collab.paint.addUserPathPoint([x, y]);
        anondraw.collab.paint.addUserPathPoint([x, y]);
    }

    function curUp() {
        cursorDown = false;
        anondraw.collab.paint.endUserPath()
    }

    /*
    function putPixel(x, y) {
        curDown();
        curPoint(x, y);
        curUp();
    }*/

    function changeColor(r, g, b) {

        let rgb = {
            r: r,
            g: g,
            b: b
        }

        anondraw.collab.paint._changeColor(tinycolor(rgb).setAlpha(globalA));

        /*
        function rgbToHex(r, g, b) {

            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);

            function componentToHex(c) {
                var hex = c.toString(16);
                return hex.length == 1 ? "0" + hex : hex;
            }
        }*/
    }
    window.drawImage = drawImage;

    function drawImage(src, x, y) {
        console.log('started')
        let image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = src;
        image.onload = function() {
            console.log('image loaded')
            let canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d');
            canvas.crossOrigin = 'anonymous';
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0, image.width, image.height);
            draw(ctx);
        }

        function draw(ctx) {
            let wid = image.width,
                hei = image.height;

            let drawPixel = function(j) {
                let o = j - 1;

                let _x = Math.floor(j / hei),
                    _y = Math.floor(j % hei),
                    __x = Math.floor(o / hei),
                    __y = Math.floor(o % hei);
                let ip = ctx.getImageData(_x, _y, 1, 1).data,
                    oip = ctx.getImageData(__x, __y, 1, 1).data;
                if (ip[3] < 127) {
                    if (++j % 1000 === 0) {
                        return setTimeout(function() {
                            drawPixel(j)
                        }, 100);
                    } else {
                        return drawPixel(j)
                    }
                }
                changeColor(ip[0], ip[1], ip[2]);
                if (ip[0] === oip[0] && ip[1] === oip[1] && ip[2] === oip[2] && _x === __x) {
                    if (anondraw.collab.paint.current_size > 2) {
                        _x *= anondraw.collab.paint.current_size / 2 | 0;
                        _y *= anondraw.collab.paint.current_size / 2 | 0;
                    }
                    if (!cursorDown) curDown();
                    curPoint(x + _x, y + _y);
                } else {
                    if (anondraw.collab.paint.current_size > 2) {
                        _x *= anondraw.collab.paint.current_size / 2 | 0;
                        _y *= anondraw.collab.paint.current_size / 2 | 0;
                    }
                    if (cursorDown) curUp();
                    curDown();
                    curPoint(x + _x, y + _y);
                }
                if (j >= wid * hei) return;
                j++
                if (!DRAW_DELAY) {
                    if (j % 100 === 0) {
                        setTimeout(function() {
                            drawPixel(j)
                        }, 50); // this is for network safety
                    } else {
                        drawPixel(j)
                    }
                } else {
                    setTimeout(function() {
                        drawPixel(j)
                    }, DRAW_DELAY);
                }
            }
            drawPixel(0);
        }
    }
})()
