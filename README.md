# Anondraw

Source code of <http://www.anondraw.com>

## Starting out with programming?

Are you just getting started and want to try to contribute? Check out the starter issues: https://github.com/Squarific/Anondraw/issues?q=is%3Aissue+is%3Aopen+label%3AStarter

They are easier problems which should be solveable by people starting out. Still too hard? Feel free to message me and I'll work on it with you.

## Questions

Have questions you need answered? Feel free to email filipsmetsbelgium@gmail.com I promise I won't bite.
Or alternativly join this discord: https://discord.gg/MDXx8qE
Or use the issues

## Before starting development

Start by pulling all the submodules with: `git submodule update --init --recursive`

### Option 1: Docker

##### Running

Install docker.
Run docker-compose up --build -d in the root folder (where the docker-compose.yml file is)
To find the url and port go in the docker-compose.yml file.

To get around certificate errors you need to open all the urls yourself and accept the certificates.
To accept the certificates for the websockets you need to change the url from wss:// to https://
Example: anondraw.min.js?v=2825593:847 WebSocket connection to 'wss://192.168.99.100:2552/socket.io/?EIO=3&transport=websocket' failed: Error in connection establishment: net::ERR_CERT_AUTHORITY_INVALID
Means goto: https://192.168.99.100:2552 and accept.

If you are not using localhost (for example if you use docker legacy on windows), you need to change the certificates in all Dockerfile to the right ip. (E.g. localhost should be changed to 192.168.99.100 if that is the ip docker gives your virtual machine).
You also need to change all clienthost in the config.json file to this ip.
ALTERNATIVLY launch your browser in a way that it ignores certificates (THIS IS UNSAFE, DO NOT USE TO BROWSE EXTERNAL SITES)

##### Clientbuilder
The clientbuilder uses a volume for /src/client/src and /src/client/dist So changes in these directories are instant and will result in a rebuild. Changes above those directories (package.json, info.json, config.json, ...) are not instantly reflected and require a rebuild of the docker images.

###### Seeing the client build logs
To see the javascript errors of the build, you can use the following command:
``` docker-compose logs -t -f clientbuilder ```

#### Login to database

Go to localhost:4400
The details are in the docker-compose.yml file.

### Option 2: Manual

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

## Hotfixes

- https://github.com/websockets/ws/pull/810
    - applied this pull request changes to ws in realtime's `node_modules/ws/lib/Sender.js` which prevents call stack crashes.
