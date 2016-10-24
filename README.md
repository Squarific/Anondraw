# Anondraw

Source code of <http://www.anondraw.com>

##  Configuration

Properties live in the `config.json` file *closest* to 
`src/server/common/config.js`. Therefore it does not matter where the config
file is placed, as long as it is in a directory that is a parent of any server.

A default `config.json` is provided in `src/config.json` as an example, but 
**should not be used in production**. 
Instead a `$NODE_ENV$.config.json` will be chosen if the environmental variable 
`NODE_ENV` is set.

### Example:

- `export NODE_ENV=` can use `src/config.json`
- `export NODE_ENV=beta` can use `/beta.config.json`
- `export NODE_ENV=production` can use `/production.config.json`
