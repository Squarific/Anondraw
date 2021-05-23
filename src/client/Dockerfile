## STAGE 1: Build ###
# Base inmage
FROM node:current AS build

WORKDIR /usr/src/app

# install yarn
RUN apt-get install curl
RUN curl -o- -L https://yarnpkg.com/install.sh | bash

# Copy files for yarn
COPY ./src/client/package.json ./client/
COPY ./src/client/.yarn/ ./client/.yarn/
COPY ./src/client/.pnp.js ./client/
COPY ./src/client/.yarnrc.yml ./client/
COPY ./src/client/yarn.lock ./client/

# Copy the build files
COPY ./src/client/info.json ./client/
COPY ./src/common/configs/config.json ./common/configs/
COPY ./src/common/config.js ./common/
COPY ./src/client/build.js ./client/
COPY ./src/client/dist/ ./client/dist/
COPY ./src/client/src/ ./client/src/

WORKDIR /usr/src/app/client/
# Build client
RUN yarn run build

### STAGE 2: Serve client ###
FROM nginx
COPY docker/nginx.default.conf /etc/nginx/conf.d/default.conf
WORKDIR /usr/share/nginx/html
COPY --from=build /usr/src/app/client/dist .

CMD ["nginx", "-g", "daemon off;"]
