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

# install yarn
RUN apt-get install curl
RUN curl -o- -L https://yarnpkg.com/install.sh | bash

# Copy files for yarn
COPY ./src/server/imageServer/package.json ./server/imageServer/
COPY ./src/server/imageServer/.yarn ./server/imageServer/.yarn
COPY ./src/server/imageServer/.pnp.js ./server/imageServer/
COPY ./src/server/imageServer/.yarnrc.yml ./server/imageServer/
COPY ./src/server/imageServer/yarn.lock ./server/imageServer/


# Copy all file
COPY ./src/server/imageServer/ ./server/imageServer/
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js
COPY ./src/common/configs/config.json ./common/configs/config.json

# # Generate self signed certificate
WORKDIR /etc/letsencrypt/live/direct.anondraw.com
# RUN openssl genrsa -out my-root-ca.key.pem 2048
# RUN openssl req -x509 -new -nodes -key my-root-ca.key.pem -days 1024 -out chain.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl genrsa -out privkey.pem 2048
# RUN openssl req -new -key privkey.pem -out csr.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl x509 -req -in csr.pem -CA chain.pem -CAkey my-root-ca.key.pem -CAcreateserial -out cert.pem -days 500


# Go back to app dir
WORKDIR /usr/src/app/server/imageServer

RUN yarn install --inline-builds

# CMD npm run server
# EXPOSE 5552
# RUN yarn

# Start server
CMD yarn run server
EXPOSE 5552
