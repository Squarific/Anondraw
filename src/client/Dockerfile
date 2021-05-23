## STAGE 1: Build ###
# Base inmage
FROM node:current AS build

WORKDIR /usr/src/app


# Copy files for yarn
COPY ./src/client/package.json ./client/
COPY ./src/client/.yarn/ ./client/.yarn/
COPY ./src/client/.pnp.js ./client/
COPY ./src/client/.yarnrc.yml ./client/
COPY ./src/client/yarn.lock ./client/

# Copy the build files
COPY ./src/common/configs/config.json ./common/configs/
COPY ./src/common/config.js ./common/
COPY ./src/client ./client

WORKDIR /usr/src/app/client/
# Build client
RUN yarn run build

### STAGE 2: Serve client ###
FROM nginx
COPY docker/nginx.default.conf /etc/nginx/conf.d/default.conf
WORKDIR /usr/share/nginx/html
COPY --from=build /usr/src/app/client/dist .

CMD ["nginx", "-g", "daemon off;"]
