openssl genrsa -out my-root-ca.key.pem 2048
openssl req -x509 -new -nodes -key my-root-ca.key.pem -days 1024 -out chain.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
openssl genrsa -out privkey.pem 2048
openssl req -new -key privkey.pem -out csr.pem -subj "/C=BE/ST=Denial/L=Very/O=Anondraw/CN=Localhost"
openssl x509 -req -in csr.pem -CA chain.pem -CAkey my-root-ca.key.pem -CAcreateserial -out cert.pem -days 500