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
 - Also [node-icu-charset-detector](https://github.com/mooz/node-icu-charset-detector) can be (optionally) used for auto charset detection, which has dependency on `libicu`. Install guide is [here](https://github.com/mooz/node-icu-charset-detector#installing-icu).

## Usage

### Class: Server
This class inherits [net.Server](https://nodejs.org/api/net.html#net_class_net_server). You can use all methods and events from net.Server such as `server.listen()`, `server.close()`, `server.on('error', function(error) { ... })`, etc.

#### new Server(options)
`options` defines all settings for server and supoorts following properties :
  - **host** : Hostname displayed on greeting message and respond to HELO/EHLO command. Server can be runned on different hostname. (default : '127.0.0.1')
  - **domain** : Domain name displayed on greeting message. (default : 'localhost')
  - **tempDir** : Path to temporary directory where body and mulitpart data files are stored. (default : './tmp/')
  - **logFile** : Path to log file. When set as false, log file won't be created. (default : false)
  - **logLevel** : Log level for logging - both for stdout and file. (default : 'info')
    - debug : Display all logs including all messages from/to client.
    - info
    - warn
    - error

#### Event: 'sessionStart'
Alias for [sessionStart event](#event-sessionstart-1) of [Receiver](#class-receiver).

#### Event: 'sessionEnd'
- [Parser](#class-parser) parser

Alias for [sessionEnd event](#event-sessionend-1) of [Receiver](#class-receiver).

#### Event: 'parseStart'
Alias for [parseStart event](#event-parsestart-1) of [Parser](#class-parser).

#### Event: 'parseEnd'
- Object mail

Alias for [parseEnd event](#event-parseend-1) of [Parser](#class-parser).

#### Event: 'receive'
- Object mail

Another alias for [parseEnd event](#event-parseend-1) of [Parser](#class-parser).

---

### Class: Receiver

#### Event: 'sessionStart'
Emitted when the server was connected to new client or client made new session (end of `DATA` or `RSET`).

#### Event: 'sessionEnd'
- [Parser](#class-parser) parser

Emitted when the server has fully recevied a mail or the client made new session (end of `DATA` or `RSET`). Not emitted when the connection has been closed before any mail was received or session was reset.

---

### Class: Parser
This class inherits [stream.Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform). You can use all methods and events from stream.Transform such as `parser.pipe()`, `parser.end()`, `parser.on('error', function(error) { ... })`, etc.

#### Event: 'parseStart'
Emitted when the first line to be parsed has been received.

#### Event: 'parseEnd'
- Object mail

`mail` argument is an object with following data :
```js
{
  header: { ... },
  body: {
    stream: stream.Readable stream,
    length: Number
  },
  multiparts: [
    {
      header: { ... },
      stream: stream.Readable stream,
      length: Number
    }, ...
  ]
}
```
- **header** : Object containing headers of received mail. All keys are converted to lowercase.
- **body** : Object containing body of received mail.
  - **stream** : [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of temporary body file.
  - **length**: Total size of stream.
- **multiparts** : Array of mime multiparts of received mail.
  - **header** : Object containing headers of each multipart. All keys are converted to lowercase.
  - **stream** : [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of each temporary multipart file.
  - **length**: Total size of stream.
