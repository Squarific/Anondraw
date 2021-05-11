# Base inmage
FROM node:current AS build

WORKDIR /app

# Install dependencies for GCC
# RUN apt-get update && apt-get install -y default-jdk

# Copy files for npm install
COPY ./src/client/package.json /app/package.json
COPY ./src/client/package-lock.json /app/package-lock.json

# Install node modules
RUN npm ci

# Copy the build files
COPY ./src/client/info.json /app/info.json
COPY ./src/server/common/config.js /app/config.js
COPY ./src/config.json /app/config.json
COPY ./src/client/build.js /app/build.js

# Start server
CMD node --unhandled-rejections=strict build.js repeat