# Base inmage
FROM node:current AS build

# Copy all file
COPY ./src/client /app
COPY ./src/server/common/config.js /app
COPY ./src/config.json /config.json

# Set working directory
WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y default-jdk
RUN npm install
RUN yarn global add serve
RUN node build.js

# Start server
CMD serve dist 
EXPOSE 5000
