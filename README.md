# Anondraw

Source code of <http://www.anondraw.com>

## Starting out with programming?

Are you just getting started and want to try to contribute? Check out the starter issues: https://github.com/Squarific/Anondraw/issues?q=is%3Aissue+is%3Aopen+label%3AStarter

They are easier problems wich should be solveable by people starting out. Still too hard? Feel free to message me and I'll work on it with you.

## Questions

Have questions you need answered? Feel free to email filipsmetsbelgium@gmail.com I promise I won't bite.
Or alternativly join this discord: https://discord.gg/MDXx8qE
Or use the issues

## Running

### Instructions

You will need to have node installed for your system. More info: https://nodejs.org/en/
You will need npm aswell. This normally is included with your node installation.

You will need the system dependencies for node-canvas: https://github.com/Automattic/node-canvas
You will also need the java jdk to run the build process.

First you will have to install the npm modules for the server.
Go into src/server and in every subfolder run `npm install`

Afterwards go back to src and make a config for your local machine. (You probably want to change all references of direct.anondraw.com to localhost). More info on the configuration is down below.

The next step is going into src/client and running `node build.js` this will build the client into the dist folder with the right configs.

Then you want to run all the js files in the server folders. Example for the realtime server: go into the realTime folder and run `node anondraw.js`

Now you can go to the src/client/dist folder and open index.html, you should now have anondraw running locally.


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
