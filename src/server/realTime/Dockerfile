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

# Copy all file
COPY ./src/server/realTime/ ./server/realTime/
COPY ./src/common/configs/config.json ./common/configs/config.json
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com

# # Copy files for yarn
COPY ./src/server/realTime/package.json ./server/realTime/
# COPY ./src/server/realTime/package-lock.json ./server/realTime/
COPY ./src/server/realTime/.yarn ./server/realTime/.yarn
COPY ./src/server/realTime/.pnp.js ./server/realTime/
COPY ./src/server/realTime/.yarnrc.yml ./server/realTime/
COPY ./src/server/realTime/yarn.lock ./server/realTime/



# # Generate self signed certificate
# WORKDIR /etc/letsencrypt/live/direct.anondraw.com
# RUN openssl genrsa -out my-root-ca.key.pem 2048
# RUN openssl req -x509 -new -nodes -key my-root-ca.key.pem -days 1024 -out chain.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl genrsa -out privkey.pem 2048
# RUN openssl req -new -key privkey.pem -out csr.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl x509 -req -in csr.pem -CA chain.pem -CAkey my-root-ca.key.pem -CAcreateserial -out cert.pem -days 500

# Go back to app dir
WORKDIR /usr/src/app/server/realTime

RUN yarn install --inline-builds
# RUN npm ci

# Start server
# CMD node anondraw.js 2556
CMD yarn run server
EXPOSE 2556
