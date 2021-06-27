# Base image
FROM node:current AS build


WORKDIR /usr/src/app
# Copy all file
COPY ./src/server/brightfoxServer ./server/brightfoxServer
COPY ./src/common/config.js ./common/config.js
COPY ./src/common/configs/config.json ./common/configs/config.json
COPY ./src/common/keys/brightfox_dev.key /etc/letsencrypt/live/direct.anondraw.com/private.key

# self signed certificate
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com

# Go back to app dir
WORKDIR /usr/src/app/server/brightfoxServer/

# Start server
CMD yarn run server
EXPOSE 6552
