#!/bin/bash

gnome-terminal --window-with-profile=hold --title="Image Server" -x ./startLocalImage.sh
gnome-terminal --window-with-profile=hold --title="Load Balancer" -x ./startLocalLoad.sh
gnome-terminal --window-with-profile=hold --title="Player Server" -x ./startLocalPlayer.sh
gnome-terminal --window-with-profile=hold --title="Realtime Server" -x ./startLocalRealTime.sh