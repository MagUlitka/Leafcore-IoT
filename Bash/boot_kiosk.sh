#!/bin/bash

export DISPLAY=:0
export XAUTHORITY=/home/orangepi/.Xauthority

xsetroot -solid "#000000"

while ! curl -s http://127.0.0.1:8081 > /dev/null; do
  sleep 1
done

xset s off
xset s noblank
xset -dpms
unclutter --timeout 0 &

exec chromium-browser \
  --kiosk \
  --incognito \
  --no-first-run \
  --noerrdialogs \
  --disable-infobars \
  --disable-dev-shm-usage \
  "http://localhost:8081"