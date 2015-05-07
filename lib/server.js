var path = require('path');
var fs = require('fs');
var net = require('net');
var util = require('util');

var Logger = require('./logger.js');

var Receiver = require('./receiver.js');

var Server = function(config) {

	Server.super_.apply(this);

	if(typeof(config) === 'object') {

		this.config = {
			host: '127.0.0.1',
			domain: 'localhost',
			tempDir: path.join('.', 'tmp'),
			defaultCharset: 'UTF-8',
			logFile: false,
			logLevel: 'info'	
		};

		for(var key in config) {
		
			if(config.hasOwnProperty(key)) {

				this.config[key] = config[key];
			
			}

		}

	} else {

		this.config = {};

	}

	var tempDir = this.config['tempDir'];

	if(!fs.existsSync(tempDir)) {

		fs.mkdirSync(tempDir);

	}

	this.logger = Logger(this.config['logLevel'], this.config['logFile']);

	this.on('listening', function() {

		this.logger.info('   server: smtpd-lite server started');

	});

	try {

		require("node-icu-charset-detector");

	} catch(error) {

		this.logger.warn("   server: Cannot find 'node-icu-charset-detector.' All DATA chunks will be considered as '"+this.config['defaultCharset']+".'");

	}

	var parent = this;

	this.on('connection', function(socket) {

		var receiver = new Receiver(this.config, socket);

		this.logger.info('   server ['+receiver.id+']: New connection opened');

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

			parent.logger.info('   server ['+receiver.id+']: Connection closed');

		});

	});

};

util.inherits(Server, net.Server);

Server.prototype.removeTemp = function(all) {

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

	parent.logger.info('   server: '+['All', 'Empty'][all ? 0 : 1] + ' temporary file(s) removed');
	parent.logger.debug('  server: Removed file(s): '+removed.join(', '));

};

module.exports = Server;
