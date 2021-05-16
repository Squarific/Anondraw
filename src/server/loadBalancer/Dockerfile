# Base inmage
FROM node:current AS build

# install yarn
RUN apt-get install curl
RUN curl -o- -L https://yarnpkg.com/install.sh | bash

# Copy all file
WORKDIR /usr/src/app
COPY ./src/server/loadBalancer/ ./server/loadBalancer/ 
COPY ./src/common/nice_console_log.js ./common/nice_console_log.js
COPY ./src/common/config.js ./common/config.js
COPY ./src/common/configs/config.json ./common/configs/config.json
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com

# Copy files for yarn
COPY ./src/server/loadBalancer/package.json ./server/loadBalancer/
COPY ./src/server/loadBalancer/.yarn ./server/loadBalancer/.yarn
COPY ./src/server/loadBalancer/.pnp.js ./server/loadBalancer/
COPY ./src/server/loadBalancer/.yarnrc.yml ./server/loadBalancer/
COPY ./src/server/loadBalancer/yarn.lock ./server/loadBalancer/


# # Generate self signed certificate
# WORKDIR /etc/letsencrypt/live/direct.anondraw.com
# RUN openssl genrsa -out my-root-ca.key.pem 2048
# RUN openssl req -x509 -new -nodes -key my-root-ca.key.pem -days 1024 -out chain.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl genrsa -out privkey.pem 2048
# RUN openssl req -new -key privkey.pem -out csr.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl x509 -req -in csr.pem -CA chain.pem -CAkey my-root-ca.key.pem -CAcreateserial -out cert.pem -days 500

# Go back to app dir
WORKDIR /usr/src/app/server/loadBalancer/ 

# Start server
CMD yarn run server
EXPOSE 3552
