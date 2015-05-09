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
	this.tlsStatus = (config['tls'] ? 0 : -1);

	this._init();

	this._socket.send(220, this._config['host']+' ESMTP for '+this._config['domain']);

	var parent = this;

	this.on('command', function(cmd, arg) {

		var heloFirst = function() {

			if(!parent.isHello) {

				parent._socket.send(503, 'EHLO/HELO command first');
				return true;

			} else {
			
				return false;
			
			}
		
		};

		switch(cmd) {

			case 'HELO':
			case 'EHLO':

				this.isHello = true;
				this._socket.send(250, this._config['host']+' at your service');

				var done = true;
				break;

			case 'STARTTLS':

				if(heloFirst()) {
				
					return;
				
				}

				this.tlsStatus = 2;

				this._logger.info(' receiver ['+this.id+']: Securing connection with TLS');

				this._socket.secure(this._config['tls']);
				this._socket.send(220, 'Go ahead');

				var done = true;
				break;

			default:

				var done = false;

		}

		if(done) {

			return;
	
		}

		if(this.tlsStatus !== 1 && this._config['tls']['force']) {

			this._socket.send(550, 'Need TLS');
			return;

		}

		switch(cmd) {

			case 'MAIL':

				if(heloFirst()) {
				
					return;
				
				}

				arg = arg.match(/^FROM: ?<([^>]+)>$/);

				if(arg) {

					this.from = arg[1];
					this._socket.send(250, 'OK');

				} else {

					this._socket.send(501, 'Bad sender address syntax');

				}

				break;

			case 'RCPT':

				if(this.from === null) {

					return this._socket.send(503, 'MAIL command first');

				}

				arg = arg.match(/^TO: ?<([^>]+)>$/);

				if(arg) {

					this.to.push(arg[1]);
					this._socket.send(250, 'OK');

				} else {
				
					this._socket.send(501, 'Bad recipient address syntax');

				}

				break;

			case 'DATA':

				if(this.to.length == 0) {

					return this._socket.send(503, 'RCPT command first');

				}

				this.isDataMode = true;

				this._socket.send(354, 'End data with <CR><LF>.<CR><LF>');

				break;

			case 'VRFY':
			case 'EXPN':
			case 'HELP':

				this._socket.send(502, 'Command not implemented');

				break;

			case 'RSET':

				this._init();

				this._socket.send(250, 'OK');

				break;

			case 'NOOP':

				this._socket.send(250, 'OK');

				break;

			case 'QUIT':

				this._socket.send(221, 'Goodbye!');
				this._socket.destroy();

				break;

			default:

				this._socket.send(500, 'Command unrecognized');

		}
	
	});

	this.on('data', function(chunk) {

		chunk = this._iconv.autoConvert(chunk).toString();
		trimmedChunk = chunk.trim();

		if(trimmedChunk[trimmedChunk.length-1] === '.') {

			chunk = chunk.substr(0, chunk.lastIndexOf('.'));

			this.dataParser.end(chunk);

			this._socket.send(250, 'OK');

			this.emit('sessionEnd', this.dataParser);

			this._init();

		} else {

			this.dataParser.write(chunk);

		}

	});

};

util.inherits(Receiver, EventEmitter);

Receiver.prototype.replaceSocket = function(socket) {

	if(this._socket) {

		this._socket._events['data'] = this._socket._events['data'].filter(function(item) {

			return (item.name !== eventHandlerId);
			
		});

	}

	var parent = this;

	this._socket = socket;

	this._socket.send = function(code, msg) {

		var res = code+' '+msg;
		this.write(res+'\n');

		var log = 'receiver ['+parent.id+']: ---> '+res;
		parent._logger.debug(log);

	};

	var onData = function(chunk) {

		if(parent.tlsStatus === 2) {

			return;

		}

		if(parent.isDataMode) {

			parent._logger.debug('receiver ['+parent.id+']: <--- (DATA chunk)');

			parent.emit('data', chunk);

		} else {

			chunk = chunk.toString().trim();

			parent._logger.debug('receiver ['+parent.id+']: <--- '+chunk);

			var spaceIndex = chunk.indexOf(' ');

			if(spaceIndex != -1) {

				var cmd = chunk.substr(0, spaceIndex).toUpperCase();
				var arg = chunk.substr(spaceIndex+1);

			} else {

				var cmd = chunk.toUpperCase();
				var arg = '';
			
			}

			parent.emit('command', cmd, arg);

		}

	};

	this._socket.on('data', renameFunction(onData, eventHandlerId));

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

		this._logger.info(' receiver ['+oldId+']: Session reset ('+this.id+')');

	}

};

module.exports = Receiver;
