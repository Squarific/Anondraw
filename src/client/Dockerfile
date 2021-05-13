## STAGE 1: Build ###
# Base inmage
FROM node:current AS build

WORKDIR /usr/src/app

# Install dependencies for GCC
# RUN apt-get update && apt-get install -y default-jdk

# Copy files for npm install
COPY ./src/client/package.json ./
COPY ./src/client/package-lock.json ./

# Install node modules
RUN npm ci

# Copy the build files
COPY ./src/client/info.json ./
COPY ./src/server/common/config.js ./
COPY ./src/config.json ./
COPY ./src/client/build.js ./
COPY ./src/client/dist/ ./dist/
COPY ./src/client/src/ ./src/

# Start server
CMD node --unhandled-rejections=strict build.js

### STAGE 2: Run ###
FROM nginx
COPY docker/nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/dist/ /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
