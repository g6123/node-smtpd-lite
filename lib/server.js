var path = require('path');
var fs = require('fs');
var util = require('util');

var SecurableServer = require('./tls.js').SecurableServer;
var Logger = require('./logger.js');
var Receiver = require('./receiver.js');

var isObject = function(sample) {

	try {
	
		return (sample.constructor === {}.constructor);
	
	} catch(error) {
	
		return false;
	
	}

};

var extend = function(target, source) {

	for(var key in source) {

		if(source.hasOwnProperty(key)) {

			if(isObject(target[key]) && isObject(source[key])) {

				target[key] = extend(target[key], source[key]);

			} else {

				target[key] = source[key];

			}

		}

	}

	return target;

};

var SmtpServer = function(config) {

	SmtpServer.super_.apply(this);

	if(isObject(config)) {

		this.config = extend({
			host: '127.0.0.1',
			domain: 'localhost',
			tls: false,
			defaultCharset: 'UTF-8',
			relaying: [],
			tempDir: path.join('.', 'tmp'),
			logFile: false,
			logLevel: 'info'	
		}, config);

	} else {

		this.config = {};

	}

	this.logger = Logger(config['logLevel'], config['logFile']);

	try {

		require("node-icu-charset-detector");

	} catch(error) {

		var msg = "   server: Cannot find 'node-icu-charset-detector.' ";
		msg += ("All DATA chunks will be considered as '"+this.config['defaultCharset']+".'");
		this.logger.warn(msg);

	}

	var parent = this;

	this.on('listening', function() {

		this.logger.info('   server: smtpd-lite server started');

	});

	this.on('securableConnection', function(socket) {

		var receiver = new Receiver(config, socket);

		var logHeader = '   server ['+receiver.id+']: ';

		parent.logger.info(logHeader+'New connection opened');

		socket.on('secure', function(cleartext, authError) {

			receiver.tlsStatus = 1;
			receiver.replaceSocket(cleartext);
			parent.logger.info(logHeader+'Connection secured with TLS');

			if(authError) {

				var msg = logHeader+'Cannot authorize secure connection; '+authError.message;
				parent.logger.warn(msg);

			}

		});

		socket.on('scureError', function(error) {

			receiver.tlsStatus = 3;
			parent.logger.error(logHeader.substr(1)+'Cannot secure connection');
		
		});

		receiver.on('sessionStart', function() {

			parent.emit('sessionStart', socket);

		});

		receiver.on('sessionEnd', function(parser) {

			parent.emit('sessionEnd', parser);

			parser.on('parseStart', function() {

				parent.emit('parseStart', parser);

			});

			parser.on('parseEnd', function(mail) {

				parent.emit('parseEnd', mail);
				parent.emit('receive', mail);

			});

		});

		socket.on('close', function() {

			parent.logger.info(logHeader+'Connection closed');

		});

	});

};

util.inherits(SmtpServer, SecurableServer);

SmtpServer.prototype.removeTemp = function(all) {

	var removed = [];

	var tempDir = this.config['tempDir'];

	fs.readdirSync(tempDir).forEach(function(item) {

		var filepath = path.join(tempDir, item);

		if(all) {

			fs.unlinkSync(filepath);
			removed.push(item);

		} else {
		
			var stat = fs.statSync(filepath);

			if(stat['size'] == 0) {

				fs.unlinkSync(filepath);
				removed.push(item);

			}

		}

	});

	this.logger.info('   server: '+['All', 'Empty'][all ? 0 : 1] + ' temporary file(s) removed');
	this.logger.debug('  server: Removed file(s): '+removed.join(', '));

};

module.exports = SmtpServer;
