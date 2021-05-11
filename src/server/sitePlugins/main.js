const express = require('express')
const app = express()
const cors = require('cors')

var mysql = require('mysql');
var pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'pluginmods',
  password: 'pluginmods',
  database: 'pluginmods',
  multipleStatements: true
});

app.use(express.json());
app.use(cors())

app.use('/plugins', require('./routes/plugins/_')(pool));
app.use('/versions', require('./routes/versions/_')(pool));

const PORT = 8755;
app.listen(PORT, '0.0.0.0', () => {
  console.log("Listening on " + PORT + "...");
});
