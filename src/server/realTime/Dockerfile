# Base inmage
FROM node:current AS build

WORKDIR /usr/src/app
# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

# Copy all file
COPY ./src/server/realTime/ ./server/realTime/
COPY ./src/common/configs/config.json ./common/configs/config.json
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js

# # Copy files for yarn
COPY ./src/server/realTime/package.json ./server/realTime/
# COPY ./src/server/realTime/package-lock.json ./server/realTime/
COPY ./src/server/realTime/.yarn ./server/realTime/.yarn
COPY ./src/server/realTime/.pnp.js ./server/realTime/
COPY ./src/server/realTime/.yarnrc.yml ./server/realTime/
COPY ./src/server/realTime/yarn.lock ./server/realTime/

# # Generate self signed certificate
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com
WORKDIR /etc/letsencrypt/live/direct.anondraw.com

# Go back to app dir
WORKDIR /usr/src/app/server/realTime

RUN yarn install --inline-builds

# Start server
# CMD node anondraw.js 2556
CMD yarn run server
EXPOSE 2556
