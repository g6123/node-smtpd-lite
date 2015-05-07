var fs = require('fs');
var path = require('path');
var util = require('util');

var Logger = require('../logger.js');

var LineStream = require('./LineStream.js');
var SkippingDecoder = require('./SkippingDecoder.js');

var mimeDecoders = require('./mimeDecoders.js');

var getBlankBody = function() {

	return { stream: null, length: 0 };

};

var getBlankPart = function() {

	return { header: {}, stream: null, length: 0 };

};

var Parser = function(config, id) {

	Parser.super_.apply(this);

	this._logger = Logger(config['logLevel'], config['logFile']);

	this._logger.parserDebug = function(msg) {

		this.debug('  parser ['+id+']: '+msg);

	};

	this._logger.parserError = function(msg) {

		this.error('  parser ['+id+']: '+msg);

	};

	mimeDecoders.init(config);

	this._status = 0;
	this._basePath = path.join(config['tempDir'], id);
	this._boundaries = [];
	this._partIndex = 0;
	this._currentHeader = [];
	this._lastHeader = [];
	this._currentPart = getBlankPart();
	this._margin = true;
	this._lastQuote = '';

	this.id = id;
	this.header = {};
	this.body = getBlankBody();
	this.multiparts = [];
	this.defaultCharset = config['defaultCharset'];

	this.once('data', function() {

		this.emit('parseStart');

		this._logger.info('   parser ['+this.id+']: Parsing started');

	});

	this.on('data', function(line) {

		var trimmedLine = line.trim();

		if(this._boundaries.indexOf(trimmedLine) == -1) {

			var gotBoundary = false;

		} else {

			var gotBoundary = true;

		}

		switch(this._status) {

			case 0:

				if(trimmedLine === '') {

					this._logger.parserDebug('Parsed mail headers');

					this.body.stream = fs.createWriteStream(this._basePath+'.body');
					this._logger.parserDebug('Created mail body stream');

					this._status = 1;

				} else {

					if(this._parseHeader(trimmedLine)) {

						this.header[this._currentHeader[0]] = this._currentHeader[1];
						this._lastHeader = this._currentHeader;

					} else {

						this._lastHeader[1] += this._currentHeader[1];
						this.header[this._lastHeader[0]] = this._lastHeader[1];

					}

				}

				break;

			case 1:

				if(gotBoundary) {

					this.body.stream.end();

					if(this.body.length == 0) {

						this.body.stream = null;

					}

					this._status = 2;

				} else {

					var encoding = this.header['content-transfer-encoding'];
					var charset = this.header['content-type'];

					line = this._parseBody(line, encoding, type);

					this.body.stream.write(line);
					this.body.length += line.length;

					this._logger.parserDebug('(DATA chunk) ---> (body stream)');

				}

				break;

			case 2:

				if(gotBoundary) {

					this._logger.parserDebug('Ignored multipart['+this._partIndex+'] (it seems empty)');

				} else if(trimmedLine == '') {

					this._logger.parserDebug('Parsed multipart['+this._partIndex+'] headers');

					var filepath = this._basePath+'.part'+this._partIndex;
					this._currentPart.stream = fs.createWriteStream(filepath);

					this._logger.parserDebug('Created mulipart['+this._partIndex+'] stream');

					this._status = 3;

				} else {

					if(this._parseHeader(trimmedLine)) {

						this._currentPart['header'][this._currentHeader[0]] = this._currentHeader[1];
						this._lastHeader = this._currentHeader;

					} else {

						this._lastHeader[1] += this._currentHeader[1];
						this._currentPart['header'][this._lastHeader[0]] = this._lastHeader[1];

					}

				}

				break;

			case 3:

				if(gotBoundary) {

					this._currentPart.stream.end();

					if(this._currentPart.length > 0) {

						this.multiparts.push(this._currentPart);

					} else {

						this._logger.parserDebug('Ignored multipart['+this._partIndex+'] (it seems empty)');

					}

					this._currentPart = getBlankPart();

					this._partIndex++;

					this._status = 2;

				} else {

					var encoding = this._currentPart['header']['content-transfer-encoding'];
					var type = this._currentPart['header']['content-type'];

					line = this._parseBody(line, encoding, type);

					this._currentPart.stream.write(line);
					this._currentPart.length += line.length;

					this._logger.parserDebug('(DATA chunk) ---> (multipart['+this._partIndex+'] stream)');

				}

		};

	});

	this.on('finish', function() {

		this._logger.parserDebug('Read all DATA chunks');

		if(this.body.stream) {

			this.body.stream = fs.createReadStream(this.body.stream['path']);

		}

		this._currentPart = getBlankPart();

		this.multiparts.forEach(function(item, index) {

			item.stream = fs.createReadStream(item.stream['path']);

		});

		this._logger.parserDebug('Converted writable streams to readable.');

		this.emit('parseEnd', {
			id: this.id,
			header: this.header,
			body: this.body,
			multiparts: this.multiparts
		});

		this._logger.info('   parser ['+this.id+']: Parsing finished');

		this._status = 4;

	});

};

util.inherits(Parser, LineStream);

Parser.prototype._parseHeader = function(trimmedLine) {

	var initiaMatch = trimmedLine.match(/^([A-Za-z-]+): ?([^$]+)$/);

	var i18nDecoder = new SkippingDecoder(
			/=\?[A-Za-z0-9-_]+\?[BbQq]\?[^\?]+\?=/g, mimeDecoders.decodeMimeWord);

	if(initiaMatch) {

		var key = initiaMatch[1].toLowerCase();
		var value = i18nDecoder.decode(initiaMatch[2]);

		this._currentHeader = [key, value];

		return true;

	} else {

		trimmedLine = i18nDecoder.decode(trimmedLine);

		var boundaryMatch = trimmedLine.match(/boundary=([^;^$]+)/);

		if(boundaryMatch) {

			var boundary = this._trimQuote(boundaryMatch[1]);

			this._boundaries.push('--'+boundary);
			this._boundaries.push('--'+boundary+'--');

		}

		this._currentHeader = [ , trimmedLine];

		return false;

	}

};

Parser.prototype._parseBody = function(line, encoding, type) {

	var trimmedLine = line.trim();

	var charset = null;
	var charsetMatch = null;

	if(type && (charsetMatch = type.match(/charset=([^;^$]+)/))) {

		charset = this._trimQuote(charsetMatch[1]);

	}

	if(encoding) {

		encoding = encoding.toLowerCase();

		if(encoding == 'base64') {

			line = mimeDecoders.decodeBase64String(line, charset);

		} else if(encoding == 'quoted-printable') {

			if(this._lastQuote) {

				line = (this._lastQuote+line);

			}

			if(trimmedLine[trimmedLine.length-1] === '=') {

				this._lastQuote = line.substr(0, line.lastIndexOf('='));
				line = '';

			} else {

				this._lastQuote = '';
				line = mimeDecoders.decodeQuotedString(line, charset)+'\n';

			}

		}

	}

	return line;

};

Parser.prototype._trimQuote = function(string) {

	string = string.trim();

	if(string.match(/^"[^"]+"$/) || string.match(/^'[^']+'$/)) {

		return string.substr(1, string.length-2);

	} else {

		return string;
	}

};

module.exports = Parser;
