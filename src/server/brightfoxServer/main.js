const config = require("../../common/config.js");
const brightfoxServer = require("./libs/Brightfox-server/main-as-module.js");
brightfoxServer({
  permfolder: config.permfolder,
  mysql: config.mysql,
  port: config.service.brightfox.port
});
