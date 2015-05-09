var util = require('util');
var EventEmitter = require('events').EventEmitter;
var crypto = require("crypto");

var Logger = require('./logger.js');
var Iconv = require('./iconv.js');
var Parser = require('./parser');

var eventHandlerId = '__SMTPD_LITE_RECEIVER__';

var renameFunction = function(fn, name) {

	var apply = Function.apply.bind(fn);

	return eval('(function '+name+'() { return apply(this, arguments); })');

};

var Receiver = function(config, socket) {

	Receiver.super_.apply(this);

	this._config = config;

	this._logger = Logger(config['logLevel'], config['logFile']);
	this._iconv = new Iconv(config);

	this.replaceSocket(socket);

	this.isHello = false;
	this.authStatus = (config['auth'] ? 0 : -1);
	this.tlsStatus = (config['tls'] ? 0 : -1);

	this._init();

	this.socket.send('220 '+this._config['host']+' ESMTP for '+this._config['domain']);

	this.on('command', function(cmd, arg) {

		switch(cmd) {

			case 'HELO':
			case 'EHLO':

				this.isHello = true;

				this.socket.send('250-'+this._config['host']+' at your service');

				if(this._config['auth']) {

					this.socket.send('250-AUTH '+this._config['auth']['type'].join(' '));

				}

				if(this._config['tls']) {

					this.socket.send('250-STARTTLS');

				}

				this.socket.send('250 8BITMIME');

				return;

			case 'RSET':

				this._init();

				this.socket.send('250 OK');

				return;

			case 'NOOP':

				this.socket.send('250 OK');

				return;

			case 'QUIT':

				this.socket.send('221 Goodbye!');
				this.socket.destroy();

				return;

		}

		if(!this.isHello) {

			this.socket.send('503 EHLO/HELO command first');
			return;

		}

		if(this._config['tls'] && cmd === 'STARTTLS') {

			if(arg === '') {

				this.tlsStatus = 2;

				this._logger.info(' receiver ['+this.id+']: Securing connection with TLS');

				this.socket.secure(this._config['tls']);

				this.socket.send('220 Go ahead');

			} else {
			
				this.socket.send('501 No parameters allowed with STARTTLS');
			
			}

			return;

		}

		if(this._config['tls']['force'] && this.tlsStatus !== 1) {

			this.socket.send('530 Must issue a STARTTLS command first');
			return;

		}

		if(this._config['auth'] && cmd === 'AUTH') {

			var spaceIndex = arg.indexOf(' ');
			var type = arg.substr(0, (spaceIndex == -1 ? undefined : spaceIndex ));

			if(this._config['auth']['type'].indexOf(type) == -1) {

				this.socket.send('504 Unrecognized authentication type');

			} else {

				this.authStatus = 2;

				this._logger.info(' receiver ['+this.id+']: Authenticating connection');

				this.emit('auth', cmd+' '+arg, this._authCallback.bind(this));

			}

			return;

		}

		if(this._config['auth']['force'] && this.authStatus !== 1) {
		
			this.socket.send('530 Authentication required');
			return;
	
		}

		switch(cmd) {

			case 'MAIL':

				arg = arg.match(/^FROM: ?<([^>]+)>$/i);

				if(arg) {

					this.from = arg[1];
					this.socket.send('250 OK');

				} else {

					this.socket.send('501 Bad sender address syntax');

				}

				break;

			case 'RCPT':

				if(this.from === null) {

					return this.socket.send('503 MAIL command first');

				}

				arg = arg.match(/^TO: ?<([^>]+)>$/i);

				if(arg) {

					this.to.push(arg[1]);
					this.socket.send('250 OK');

				} else {

					this.socket.send('501 Bad recipient address syntax');

				}

				break;

			case 'DATA':

				if(this.to.length == 0) {

					return this.socket.send('503 RCPT command first');

				}

				this.isDataMode = true;

				this.socket.send('354 End data with <CR><LF>.<CR><LF>');

				break;

			case 'VRFY':
			case 'EXPN':
			case 'HELP':

				this.socket.send('502 Command not implemented');

				break;

			default:

				this.socket.send('500 Command unrecognized');

		}
	
	});

	this.on('data', function(chunk) {

		chunk = this._iconv.autoConvert(chunk).toString();
		trimmedChunk = chunk.trim();

		if(trimmedChunk[trimmedChunk.length-1] === '.') {

			chunk = chunk.substr(0, chunk.lastIndexOf('.'));

			this.dataParser.end(chunk);

			this.socket.send('250 OK');

			this.emit('sessionEnd', this.dataParser);

			this._init();

		} else {

			this.dataParser.write(chunk);

		}

	});

};

util.inherits(Receiver, EventEmitter);

Receiver.prototype.replaceSocket = function(socket) {

	if(this.socket) {

		this.socket._events['data'] = this.socket._events['data'].filter(function(item) {

			return (item.name !== eventHandlerId);
			
		});

	}

	var parent = this;

	this.socket = socket;

	this.socket.send = function(msg) {

		this.write(msg+'\n');
		parent._logger.debug('receiver ['+parent.id+']: ---> '+msg);

	};

	var onData = function(chunk) {

		var logHeader = 'receiver ['+parent.id+']: <--- ';

		if(parent.tlsStatus === 2) {

			return;

		}

		if(parent.authStatus === 2) {

			parent._logger.debug(logHeader+'(Authentication message)');

			parent.emit('auth', chunk.toString().trim(), this._authCallback.bind(parent));

			return;

		}

		if(parent.isDataMode) {

			parent._logger.debug(logHeader+'(DATA chunk)');

			parent.emit('data', chunk);

			return;

		}

		chunk = chunk.toString().trim();

		parent._logger.debug(logHeader+chunk);

		var spaceIndex = chunk.indexOf(' ');

		if(spaceIndex != -1) {

			var cmd = chunk.substr(0, spaceIndex).toUpperCase();
			var arg = chunk.substr(spaceIndex+1).trim();

		} else {

			var cmd = chunk.toUpperCase();
			var arg = '';
		
		}

		parent.emit('command', cmd, arg);

	};

	this.socket.on('data', renameFunction(onData, eventHandlerId));

};

Receiver.prototype._init = function() {

	var oldId = this.id;

	this.isDataMode = false;

	this.id = crypto.randomBytes(10).toString('hex');
	this.dataParser = new Parser(this._config, this.id);

	this.from = null;
	this.to = [];

	this.emit('sessionStart');

	if(oldId) {

		this._logger.info(' receiver ['+this.id+']: Session reset ('+oldId+')');

	}

};

Receiver.prototype._authCallback = function(error) {

	if(error) {
	
		this.authStatus = 0;
		this._logger.info(' receiver ['+this.id+']: Connection authentication failed');

	} else {

		this.authStatus = 1;
		this._logger.info(' receiver ['+this.id+']: Connection authenticated');
	
	}

};

module.exports = Receiver;
