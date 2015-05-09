# node-smtpd-lite
An uncomplicated SMTP mail receiver for Node.js.

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
    - **force** : Whether to force client to use TLS
    - **key** : A [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) or [buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) containing the private key of the server in PEM format. (Could be an array of keys). (Required if you use TLS)
    - **cert** : A [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) or [buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) containing the certificate key of the server in PEM format. (Could be an array of certs). (Required if you use TLS)
    - **ca**: An [array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) of [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)s or [buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer)s of trusted certificates in PEM format. If this is omitted several well known "root" CAs will be used, like VeriSign. These are used to authorize connections.
    - ..and more TLS security context options. For more details, see [here](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_details).
  - **auth** : When set this `false`, all authentication features are disabled. (default : false)
    - **force** : Whether to force client to log in
    - **type** : An [array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) of [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)s indicating types of authentication mechanism to be used. Only authentications with these mechanisms will be allowed.
  - **defaultCharset** : Charset to use as default for parsing mails (default : 'UTF-8')
  - **tempDir** : Path to temporary directory where body and mulitpart data files are stored (default : './tmp/')
  - **logFile** : Path to log file. When set `false`, log file won't be created. (default : false)
  - **logLevel** : Log level for logging - both for stdout and file (default : 'info')
    - debug : Display all logs including all messages from/to client.
    - info
    - warn
    - error

#### server.removeTemp([all])
Removes temporary files in the directory configured by `config['tempDir']`. If `all` argument is given `true`, it removes all files in the directory. Otherwise, it removes only empty (zero-size) files.

#### Event: 'sessionStart'
- [Receiver](#class-receiver) receiver

Alias for [sessionStart event](#event-sessionstart-1) of [Receiver](#class-receiver).

#### Event: 'sessionEnd'
- [Parser](#class-parser) parser

Alias for [sessionEnd event](#event-sessionend-1) of [Receiver](#class-receiver).

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
Replaces the socket which the receiver uses. Also it removes, from the old socket, event listeners registered by receiver, and sets the same listeners on the new socket.

#### receiver.socket
[The socket](https://nodejs.org/api/net.html#net_class_net_socket) a receiver is currently using.

#### receiver.isHello
Indicates whether or not HELO/EHLO message response was sent.

#### receiver.tlsStatus
There are four possible states.

- `-1` means that TLS features are disabled.
- `0` means TLS features are enabled, but the socket is not secure due to failed negotiation or just because TLS negotiation has not yet started.
- `1` means the socket is secured with TLS.
- `2` means that server is negotiating with the client.

#### receiver.authStatus
There are four possible states.

- `-1` means authentication is disabled.
- `0` means authentication feature is enabled, but the client has not yet logged in or the authentication has failed.
- `1` means the client has been authenticated successfully.
- `2` means authentication is in the progress.

#### receiver.from

#### receiver.to

#### Event: 'sessionStart'
Emitted when the server was connected to a new client or the client made a new session (`RSET` or the end of `DATA`.)

#### Event: 'auth'
- [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) data
- [Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function) function callback(error) { ... }

Emitted when the client sends `AUTH` command. Until `callback` is called, all data chunks from the client is processed only by event listener listening on this auth event. When `callback` is called with `error`, the receiver will consider the authentication has failed. Below is an example code.

```js
var Server = require('smtpd-lite');

var server = new Server({
	auth: {
		force: false,
		type: ['DIGEST-MD5', 'CRAM-MD5']
	}
});

server.on('sessionStart', function(receiver) {

	receiver.on('auth', function(data, callback) {

		// Authenticate the client with the given `data`..

		if(error) {

			receiver.socket.send(error + 'Authentication failed');

		} else {

			receiver.socket.send('235 Authentication successful');

		}

		callback(error);

	});

});
```

#### Event: 'sessionEnd'
- [Parser](#class-parser) parser

Emitted when the server reached the end of a mail or the client made new session (`RSET` or the end of `DATA`.) Not emitted when the connection has been closed or session been reset before any mail had been received.

---

### Class: Parser
This class inherits [stream.Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform). You can use all methods and events from stream.Transform such as `parser.pipe()`, `parser.end()`, `parser.on('error', function(error) { ... })`, etc.

#### Event: 'parseStart'
Emitted when the first line to be parsed is received.

#### Event: 'parseEnd'
- [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) mail

`mail` argument is an object with following properties :
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
- **id**: An unique string of the session where the mail was received.
- **header** : An object containing headers of the received mail. All keys are converted to the lowercase.
- **body** : An object containing a body of the received mail.
  - **stream** : A [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of the temporary body file.
  - **length**: Total size of the data written on `stream`.
- **multiparts** : An array of mime multiparts of the received mail.
  - **header** : An object containing headers of each multipart. All keys are converted to the lowercase.
  - **stream** : A [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of each temporary multipart file.
  - **length**: Total size of the data written on each `stream`.
