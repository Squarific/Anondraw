# Base image
FROM node:current AS build

WORKDIR /usr/src/app
# Copy all file
COPY ./src/server/sitePlugins/ ./server/sitePlugins/
COPY ./src/common/config.js ./common/config.js
COPY ./src/common/configs/config.json ./common/configs/config.json
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com
COPY ./src/common/keys/siteplugins_dev.key /etc/letsencrypt/live/direct.anondraw.com/private.key

# # Generate self signed certificate
# WORKDIR /etc/letsencrypt/live/direct.anondraw.com
# RUN openssl genrsa -out my-root-ca.key.pem 2048
# RUN openssl req -x509 -new -nodes -key my-root-ca.key.pem -days 1024 -out chain.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl genrsa -out privkey.pem 2048
# RUN openssl req -new -key privkey.pem -out csr.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
# RUN openssl x509 -req -in csr.pem -CA chain.pem -CAkey my-root-ca.key.pem -CAcreateserial -out cert.pem -days 500

# Go back to app dir
WORKDIR /usr/src/app/server/sitePlugins/

# Start server
CMD yarn run server
EXPOSE 6552
