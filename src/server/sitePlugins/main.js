const express = require('express')
const https = require('https')
const cors = require('cors')
const fs = require('fs');
const app = express()

const config = require("../../common/config.js");

const mysql = require('mysql');
const pool = mysql.createPool({
  connectionLimit: 10,
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  multipleStatements: true
});



const options = {
  key: fs.readFileSync(config.permfolder + '/privkey.pem'),
  cert: fs.readFileSync(config.permfolder + '/cert.pem'),
  ca: fs.readFileSync(config.permfolder + '/chain.pem')
};

app.use(express.json());
app.use(cors())

app.use('/plugins', require('./routes/plugins/_')(pool));
app.use('/versions', require('./routes/versions/_')(pool));

const PORT = 6552;
https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
  console.log("Listening on " + PORT + "...");
});
