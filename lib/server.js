var path = require('path');
var _ = require('underscore');
var fs = require('fs');
var net = require('net');
var async = require('async');
var util = require('util');

var Logger = require('./logger.js');
var Receiver = require('./receiver.js');

var Server = function(config) {

	this.config = _.defaults(config, {
		host: '127.0.0.1',
		domain: 'localhost',
		tempDir: path.join('.', 'tmp'),
		logFile: false,
		logLevel: 'info'
	});

	var tempDir = this.config['tempDir'];

	if(!fs.existsSync(tempDir)) {

		fs.mkdirSync(tempDir);

	}

	this.logger = Logger(this.config['logLevel'], this.config['logFile']);

	this.on('listening', function() {

		this.logger.info('smtpd-lite server started');

	});

	try {

		require("node-icu-charset-detector");

	} catch(error) {

		this.logger.warn("Cannot find 'node-icu-charset-detector.' Auto charset detection wil be disabled.");

	}

	var parent = this;

	this.on('connection', function(socket) {

		var receiver = new Receiver(this.config, this.logger, socket);

		this.logger.info('New connection opened ['+receiver.id+']');

		receiver.on('sessionStart', function() {
		
			parent.emit('sessionStart', socket);

		});

		receiver.on('sessionEnd', function(parser) {

			parser.on('parseStart', function() {

				parent.emit('parseStart', parser);
			
			});

			parser.on('parseEnd', function(mail) {

				parent.emit('parseEnd', mail);
				parent.emit('receive', mail);

			});

		});

		socket.on('close', function() {

			parent.logger.info('Connection closed ['+receiver.id+']');
			parent.removeTemp();

		});

	});

};

util.inherits(Server, net.Server);

Server.prototype.removeTemp = function(all) {

	var parent = this;
	var tempDir = this.config['tempDir'];

	async.map(fs.readdirSync(tempDir), function(item, callback) {

		var filepath = path.join(tempDir, item);

		if(all) {

			fs.unlinkSync(filepath);
			callback(null, item);

		} else {

			if(fs.statSync(filepath)['size'] == 0) {

				fs.unlinkSync(filepath);
				callback(null, item);

			} else {

				callback(null);

			}

		}

	}, function(error, result) {

		result = _.compact(result);

		parent.logger.info(['All', 'Empty'][all ? 0 : 1] + ' temporary file(s) removed');
		parent.logger.debug('Removed file(s): '+result.join(', '));

	});

};

module.exports = Server;
