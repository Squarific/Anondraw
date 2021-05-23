# Base inmage
FROM node:current AS build

# Copy all file
WORKDIR /usr/src/app
COPY ./src/server/loadBalancer/ ./server/loadBalancer/ 
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js
COPY ./src/common/configs/config.json ./common/configs/config.json

# self signed certificate
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com

# Go back to app dir
WORKDIR /usr/src/app/server/loadBalancer/ 

# Start server
CMD yarn run server
EXPOSE 3552
