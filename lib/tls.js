var net = require('net');
var tls = require('tls');
var util = require('util');

var getCleartext = function(pair, socket) {

	pair.encrypted.pipe(socket);
	socket.pipe(pair.encrypted);
	pair.fd = socket.fd;

	var cleartext = pair.cleartext;

	cleartext.socket = socket;
	cleartext.encrypted = pair.encrypted;
	cleartext.authorized = false;

	socket.on('error', function(error) {

		cleartext.emit('error', error);

	});

	socket.on('close', function() {

		cleartext.emit('close');

	});

	return cleartext;

};

var SecurableServer = function() {

	SecurableServer.super_.apply(this, arguments);

	this.on('connection', function(socket) {

		socket.secure = function(config) {

			if(!config) {

				var config = {};
			
			}

			if(!callback) {

				var callback = function() {};
			
			}

			var context = tls.createSecureContext(config);
			var pair = tls.createSecurePair(context, true, true, false);

			var cleartext = getCleartext(pair, socket);

			if(socket._timeout) {

				cleartext.setTimeout(socket._timeout);

			}

			cleartext.setKeepAlive(socket._keepalive);

			pair.on('error', function(error) {

				socket.emit('secureError', error);

			});

			pair.on('secure', function() {

				var authError = pair.ssl.verifyError();
				socket.emit('secure', cleartext, authError);

			});

		};

		this.emit('securableConnection', socket);
	
	});

};

util.inherits(SecurableServer, net.Server);

module.exports.SecurableServer = SecurableServer;
