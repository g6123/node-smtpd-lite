# node-smtpd-lite
Simple SMTP mail receiver for Node.js.

## Quick example
```js
var Server = require('smtpd-lite');

var server = new Server({
  host: 'mail.example.com',
  domain: 'example.com'
});

server.on('receive', function(mail) {
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
 - Also [node-icu-charset-detector](https://github.com/mooz/node-icu-charset-detector) can be optionally used for auto charset detection, which has dependency on `libicu`. Install guide is [here](https://github.com/mooz/node-icu-charset-detector#installing-icu).

## Usage

### Class: Server
This class inherits [net.Server](https://nodejs.org/api/net.html#net_class_net_server). You can use all methods and events from net.Server such as `server.listen()`, `server.close()`, `server.on('error', function(error) { ... })`, etc.

#### new Server(options)
`options` defines all settings for server and supoorts following properties :
  - **host** : Hostname displayed on greeting message and respond to HELO/EHLO command. Server can be runned on different hostname. (default : '127.0.0.1')
  - **domain** : Domain name displayed on greeting message (default : 'localhost')
  - **tls**: When set this `false`, all TLS features are disabled. (default : false)
    - **force** : Whether to force client to use TLS (default : false)
    - **key** : A [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) or [buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) containing the private key of the server in PEM format. (Could be an array of keys). (Required if you use TLS)
    - **cert** : A [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) or [buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) containing the certificate key of the server in PEM format. (Could be an array of certs). (Required if you use TLS)
    - **ca**: An [array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) of [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)s or [buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer)s of trusted certificates in PEM format. If this is omitted several well known "root" CAs will be used, like VeriSign. These are used to authorize connections.
    - ..and more TLS security context options. For more details, see [here](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_details).
  - **defaultCharset** : Charset to use as default for parsing mails (default : 'UTF-8')
  - **tempDir** : Path to temporary directory where body and mulitpart data files are stored (default : './tmp/')
  - **logFile** : Path to log file. When set `false`, log file won't be created. (default : false)
  - **logLevel** : Log level for logging - both for stdout and file (default : 'info')
    - debug : Display all logs including all messages from/to client.
    - info
    - warn
    - error

#### server.removeTemp([all])
Removes temporary files in the directory configured with `config['tempDir']`. If `all` argument is given `true`, it removes all files in the directory. Otherwise, it removes only empty (zero-size) files.

#### Event: 'sessionStart'
- [net.Socket](https://nodejs.org/api/net.html#net_class_net_socket) socket

Alias for [sessionStart event](#event-sessionstart-1) of [Receiver](#class-receiver).

#### Event: 'sessionEnd'
- [Parser](#class-parser) parser

Alias for [sessionEnd event](#event-sessionend-1) of [Receiver](#class-receiver).

#### Event: 'secure'
- [tls.TLSSocket](https://nodejs.org/api/tls.html#tls_class_tls_tlssocket) cleartext
- [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) authError

Alias for [secure event](https://nodejs.org/api/tls.html#tls_event_secure) of [tls.SecurePair](https://nodejs.org/api/tls.html#tls_class_securepair)

#### Event: 'scureError'
- [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) error

Alias for error event of [tls.SecurePair](https://nodejs.org/api/tls.html#tls_class_securepair)

#### Event: 'parseStart'
- [Parser](#class-parser) parser

Alias for [parseStart event](#event-parsestart-1) of [Parser](#class-parser).

#### Event: 'parseEnd'
- [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) mail

Alias for [parseEnd event](#event-parseend-1) of [Parser](#class-parser).

#### Event: 'receive'
- [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) mail

Another alias for [parseEnd event](#event-parseend-1) of [Parser](#class-parser).

---

### Class: Receiver

#### receiver.replaceSocket(socket)

Replaces the socket [Receiver](#class-receiver) object uses. Also it removes event listeners registered by [Receiver](#class-receiver) from the old socket, and set the same listeners on the new socket.

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
- [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) mail

`mail` argument is an object with following data :
```js
{
  id: String,
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
- **id**: Unique string of the session where the mail was received.
- **header** : Object containing headers of received mail. All keys are converted to lowercase.
- **body** : Object containing body of received mail.
  - **stream** : [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of temporary body file.
  - **length**: Total size of stream.
- **multiparts** : Array of mime multiparts of received mail.
  - **header** : Object containing headers of each multipart. All keys are converted to lowercase.
  - **stream** : [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of each temporary multipart file.
  - **length**: Total size of stream.
