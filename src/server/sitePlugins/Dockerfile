# Base inmage
FROM node:current AS build

# Copy all file
COPY ./src/server/sitePlugins /app
COPY ./src/server/common /common
COPY ./src/config.json /config.json
RUN mkdir -p /etc/letsencrypt/live/direct.anondraw.com
COPY ./src/siteplugins_dev.key /etc/letsencrypt/live/direct.anondraw.com/private.key

# Set working directory
WORKDIR /app

# Install dependencies
RUN npm ci

# Generate self signed certificate
WORKDIR /etc/letsencrypt/live/direct.anondraw.com
RUN openssl genrsa -out my-root-ca.key.pem 2048
RUN openssl req -x509 -new -nodes -key my-root-ca.key.pem -days 1024 -out chain.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=192.168.99.100"
RUN openssl genrsa -out privkey.pem 2048
RUN openssl req -new -key privkey.pem -out csr.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=192.168.99.100"
RUN openssl x509 -req -in csr.pem -CA chain.pem -CAkey my-root-ca.key.pem -CAcreateserial -out cert.pem -days 500

# Go back to app dir
WORKDIR /app

# Start server
CMD node main.js
EXPOSE 6552
