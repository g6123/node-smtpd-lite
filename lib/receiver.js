var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Logger = require('./logger.js');
var Iconv = require('./iconv.js');

var Parser = require('./parser');

var Receiver = function(config, socket) {

	Receiver.super_.apply(this);

	this._config = config;

	this._logger = Logger(config['logLevel'], config['logFile']);
	this._iconv = new Iconv(config);

	this._socket = socket;

	this.isHello = false;

	this._init();

	var parent = this;

	this._socket.send = function(code, msg) {

		var res = code+' '+msg;
		this.write(res+'\n');

		var log = 'receiver ['+parent.id+']: ---> '+res;
		parent._logger.debug(log);

	};

	this._socket.send(220, this._config['host']+' ESMTP for '+this._config['domain']);

	this._socket.on('data', function(chunk) {

		if(parent.isDataMode) {
		
			parent._logger.debug('receiver ['+parent.id+']: <--- (DATA chunk)');

			parent.emit('data', chunk);

		} else {

			chunk = chunk.toString().trim();

			parent._logger.debug('receiver ['+parent.id+']: <--- '+chunk);

			var spaceIndex = chunk.indexOf(' ');

			if(spaceIndex != -1) {

				var cmd = chunk.substr(0, spaceIndex);
				var arg = chunk.substr(spaceIndex+1);

			} else {
			
				var cmd = chunk;
				var arg = '';
			
			}

			parent.emit('command', cmd, arg);

		}

	});

	this.on('command', function(cmd, arg) {

		switch(cmd) {
		
			case 'HELO':
			case 'EHLO':

				this.isHello = true;
				this._socket.send(250, this._config['host']+' at your service');

				break;

			case 'MAIL':

				if(!this.isHello) {

					return this._socket.send(503, 'EHLO/HELO command first');

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

				break;

		}
	
	});

	this.on('data', function(chunk) {

		chunk = this._iconv.autoConvert(chunk).toString().trim();

		if(chunk[chunk.length-1] === '.') {

			this.dataParser.write(chunk.substr(0, chunk.length-1));

			this.emit('sessionEnd', this.dataParser);

			this.dataParser.end();

			this._socket.send(250, 'OK');

			this._init();

		} else {

			this.dataParser.write(chunk);

		}

	});

};

util.inherits(Receiver, EventEmitter);

Receiver.prototype._init = function() {

	var oldId = this.id;

	this.isDataMode = false;

	this.id = Math.random().toString(36).substr(2);
	this.dataParser = new Parser(this._config, this.id);

	this.from = null;
	this.to = [];

	this.emit('sessionStart');

	if(oldId) {

		this._logger.info(' receiver ['+oldId+']: Session reset ( -> '+this.id+')');

	}

};

module.exports = Receiver;
