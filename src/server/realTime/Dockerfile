# Base inmage
FROM node:18 AS build
# With 'node:current', the build process for the binaries of 'node-canvas' fails.
# Currently there doesn't seem to be binaries for this version of Linux + Node v20 + node-canvas.
# The latest release of node-canvas [v2.11.2](https://github.com/Automattic/node-canvas/releases/tag/v2.11.2)
#   should work, but it doesn't. The binaries can't be built when running the build process in `yarn install`.
# We will probably get a proper binary for Node v20 later, so for now we'll fallback to Node v18.

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
COPY ./src/server/realTime/ ./server/realTime/
COPY ./src/common/configs/config.json ./common/configs/config.json
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js

# # Generate self signed certificate
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com

# Go back to app dir
WORKDIR /usr/src/app/server/realTime

RUN yarn install --inline-builds

# Start server
# CMD node anondraw.js 2556
CMD yarn run server
EXPOSE 2556
