# Base inmage
FROM node:current AS build

# Copy all file
WORKDIR /usr/src/app

# Copy all file
COPY ./src/server/playerServer/ ./server/playerServer/
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js
COPY ./src/common/configs/config.json ./common/configs/config.json

# # self signed certificate
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com

# Go back to app dir
WORKDIR /usr/src/app/server/playerServer/

# Start server
CMD yarn run server
EXPOSE 4552
EXPOSE 2552
