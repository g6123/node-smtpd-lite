var fs = require('fs');
var path = require('path');
var Iconv = require('iconv').Iconv;
var util = require('util');

var Logger = require('../logger.js');

var LineStream = require('./LineStream.js');
var SkippingDecoder = require('./SkippingDecoder.js');

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

	this._status = 0;
	this._basePath = path.join(config['tempDir'], id);
	this._boundaries = [];
	this._partIndex = 0;
	this._currentHeader = [];
	this._lastHeader = [];
	this._currentPart = getBlankPart();
	this._margin = true;

	this.id = id;
	this.header = {};
	this.body = getBlankBody();
	this.multiparts = [];
	
	this.once('data', function() {

		this.emit('parseStart', this);

		this._logger.info('   parser ['+this.id+']: Parsing started');

	});

	this.on('data', function(line) {

		if(this._boundaries.indexOf(line) == -1) {

			var transition = false;

		} else {

			var transition = true;
		
		}

		switch(this._status) {

			case 0:

				if(!line) {

					this._logger.parserDebug('Parsed mail headers');

					this.body['stream'] = fs.createWriteStream(this._basePath+'.body');
					this._logger.parserDebug('Created mail body stream');

					this._status = 1;

				} else {

					if(this._parseHeader(line)) {

						this.header[this._currentHeader[0]] = this._currentHeader[1];
						this._lastHeader = this._currentHeader;

					} else {

						this._lastHeader[1] += this._currentHeader[1];
						this.header[this._lastHeader[0]] = this._lastHeader[1];

					}

				}

				break;

			case 1:

				if(transition) {

					this.body['stream'].end();

					if(this.body['length'] == 0) {

						this.body = null;

					}

					this._status = 2;
				
				} else {

					var encoding = this.header['content-transfer-encoding'];

					if(encoding && encoding.toLowerCase() == 'base64') {
					
						line = new Buffer(line, 'base64');

					}

					this.body['stream'].write(line);
					this.body['length'] += line.length;

					this._logger.parserDebug('(DATA chunk) ---> (body stream)');

				}
				
				break;

			case 2:

				if(transition) {

					this._logger.parserDebug('Ignored multipart['+this._partIndex+'] (it seems empty)');
	
				} else if(!line) {

					this._logger.parserDebug('Parsed multipart['+this._partIndex+'] headers');

					var filepath = this._basePath+'.part'+this._partIndex;
					this._currentPart['stream'] = fs.createWriteStream(filepath);

					this._logger.parserDebug('Created mulipart['+this._partIndex+'] stream');

					this._status = 3;

				} else {

					if(this._parseHeader(line)) {
					
						this._currentPart['header'][this._currentHeader[0]] = this._currentHeader[1];
						this._lastHeader = this._currentHeader;

					} else {

						this._lastHeader[1] += this._currentHeader[1];
						this._currentPart['header'][this._lastHeader[0]] = this._lastHeader[1];

					}

				}
 
				break;

			case 3:

				if(transition) {
				
					this._currentPart['stream'].end();

					if(this._currentPart['length'] > 0) {

						this.multiparts.push(this._currentPart);

					} else {
					
						this._logger.parserDebug('Ignored multipart['+this._partIndex+'] (it seems empty)');
					
					}

					this._currentPart = getBlankPart();

					this._partIndex++;

					this._status = 2;

				} else {

					var encoding = this._currentPart['header']['content-transfer-encoding'];

					if(encoding && encoding.toLowerCase() == 'base64') {
					
						line = new Buffer(line, 'base64');

					}

					this._currentPart['stream'].write(line);
					this._currentPart['length'] += line.length;

					this._logger.parserDebug('(DATA chunk) ---> (multipart['+this._partIndex+'] stream)');

				}
		
		};
	
	});

	this.on('finish', function() {

		this._logger.parserDebug('Read all DATA chunks');

		if(this.body && this.body['stream']) {

			this.body['stream'] = fs.createReadStream(this.body['stream']['path']);
	
		}

		this._currentPart = getBlankPart();

		this.multiparts.forEach(function(item, index) {
	
			item['stream'] = fs.createReadStream(item['stream'].path);

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

Parser.prototype._parseHeader = function(line) {

	var initiaMatch = line.match(/^([A-Za-z-]+): ?([^$]+)$/);
	
	var i18nDecoder = new SkippingDecoder(/=\?[A-Za-z0-9-]+\?[BbQq]\?[^\?]+\?=/g, this._decodeMimeWord);

	if(initiaMatch) {

		var key = initiaMatch[1].toLowerCase();
		var value = i18nDecoder.decode(initiaMatch[2]);

		this._currentHeader = [key, value];

		return true;

	} else {

		line = i18nDecoder.decode(line);

		boundaryMatch = line.match(/boundary=([^;^$]+)/);

		if(boundaryMatch) {

			var boundary = boundaryMatch[1].trim();

			if(boundary[0].match(/["']/) && boundary[boundary.length-1].match(/["']/)) {

				boundary = boundary.substr(1, boundary.length-2);

			}

			this._boundaries.push('--'+boundary);
			this._boundaries.push('--'+boundary+'--');

		}

		this._currentHeader = [ , line];

		return false;

	}

};

Parser.prototype._decodeMimeWord = function(word) {

	var wordExp = new RegExp(/=\?([A-Za-z0-9-]+)\?([BbQq]+)\?([^\?]+)\?=/);
	word = word.match(wordExp);

	var charset = word[1];

	if(charset.toUpperCase() == 'EUC-KR') {

		charset = 'CP949';
	
	}

	var type = word[2].toLowerCase();
	var string = word[3];

	if(type == 'b') {

		var buf = new Buffer(string, 'base64');
		var iconv = new Iconv(charset, 'UTF-8');
		return iconv.convert(buf).toString();

	}
	
	if(type == 'q') {

		var QuoteDecoder = new SkippingDecoder(/(=[0-9A-Fa-f]{2})+/g, function(data) {
		
			var buf = new Buffer(data.split('=').join(''), 'hex');
			var iconv = new Iconv(charset, 'UTF-8');
			return iconv.convert(buf).toString();

		});

		return QuoteDecoder.decode(string);
	
	}

	this._logger.parserError('Unknown mime word type : '+type);

};

module.exports = Parser;
