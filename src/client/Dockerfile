# Base inmage
FROM node:current AS build

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y default-jdk

# Copy all files
COPY ./src/server/common/config.js /app/config.js
COPY ./src/config.json /app/config.json
COPY ./src/client/build.js /app/build.js
COPY ./src/client/package.json /app/package.json
COPY ./src/client/package-lock.json /app/package-lock.json
COPY ./src/client/info.json /app/info.json

# Install node modules
RUN npm install

# Start server
CMD node build.js repeat