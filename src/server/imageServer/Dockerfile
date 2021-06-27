# Base inmage
FROM node:current AS build

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

WORKDIR /usr/src/app
    
# Copy all file
COPY ./src/server/imageServer/ ./server/imageServer/
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/configs/config.json ./common/configs/config.json
COPY ./src/common/config.js ./common/config.js

# Generate dir for certificates
WORKDIR /etc/letsencrypt/live/direct.anondraw.com

# Go back to app dir
WORKDIR /usr/src/app/server/imageServer

RUN yarn install --inline-builds

# Start server
CMD yarn run server
EXPOSE 5552
