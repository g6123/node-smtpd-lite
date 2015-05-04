# node-smtpd-lite
Simple SMTP mail receiver for Node.js.

## Quick example
```js
var Smtpd = require('smtpd-lite');

var smtpd = new Smtpd({
  host: 'mail.example.com',
  domain: 'example.com'
});

smtpd.on('receive', function(mail) {
  console.log(mail);
});

server.listen(25);
```

## Installation

```bash
# Install with npm
$ npm install smtpd-lite

# Install from source code
$ git clone https://github.com/g6123/node-smtpd-lite.git smtpd-lite
```

### Dependency
 - `smtpd-lite` uses [new stream API (stream2)](http://blog.nodejs.org/2012/12/20/streams2/), and is supported for Node.js v0.10+.
 - Also [node-icu-charset-detector](/mooz/node-icu-charset-detector) is required for charset detection, which has dependency on `libicu`. Install guide is [here](/mooz/node-icu-charset-detector#installing-icu).

## Usage
To start a server,
```js
var Smtpd = require('smtpd-lite');
var smtpd = new Smtpd(config);
smtpd.listen(port[, host][, backlog][, callback]);
// server.listen(path[, callback])
// server.listen(handle[, callback])
// server.listen(options[, callback])
```

- **config** defines all settings for server
  - **host** : Hostname displayed on greeting message and respond to HELO/EHLO command. Server can be runned on different hostname. (default : '127.0.0.1')
  - **domain** : Domain name displayed on greeting message. (default : 'localhost')
  - **tempDir** : Path to temporary directory where body and mulitpart data files are stored. (default : './tmp/')
  - **logFile** : Path to log file. When set as false, log file won't be created. (default : false)
  - **logLevel** : Log level for logging - both for stdout and file. (default : 'info')
    - debug : Display all logs including all messages from/to client.
    - info
    - warn
    - error

- **smtpd.listen** is a method inherited from [net.Server](https://nodejs.org/api/net.html#net_class_net_server).
