var stream = require('stream');
var fs = require('fs');
var path = require('path');
var mimelib = require('mimelib');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var getBlankBody = function() {

	return { stream: null, length: 0 };

};

var getBlankPart = function() {

	return { header: {}, stream: null, length: 0 };

};

var Parser = function(config, id) {

	stream.Transform.call(this, { objectMode: true });

	this._status = 0;
	this._basePath = path.join(config['tempDir'], id);
	this._boundaries = [];
	this._partIndex = 0;
	this._currentHeader = [];
	this._lastHeader = [];
	this._currentPart = getBlankPart();

	this.id = id;
	this.header = {};
	this.body = getBlankBody();
	this.multiparts = [];

	this.on('data', function(line) {

		switch(this._status) {

			case 0:

				this.emit('parseStart');

				if(line == '') {
				
					this.body['stream'] = fs.createWriteStream(this._basePath+'.body');

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

				if(this._boundaries.indexOf(line) >= 0) {

					this.body['stream'].end();

					if(this.body['length'] == 0) {

						this.body = null;

					}

					this._status = 2;
				
				} else if(line) {

					this.body['stream'].write(line+'\n');
					this.body['length'] += line.length;

				}
				
				break;

			case 2:

				if(line == '') {

					var filepath = this._basePath+'.part'+this._partIndex;
					this._currentPart['stream'] = fs.createWriteStream(filepath);

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

				if(this._boundaries.indexOf(line) >= 0) {
				
					this._currentPart['stream'].end();

					if(this._currentPart['length'] > 0) {

						this.multiparts.push(this._currentPart);

					}

					this._currentPart = getBlankPart();

					this._partIndex++;

					this._status = 2;

				} else if(line) {

					if(this._currentPart['header']['content-transfer-encoding'].toLowerCase() == 'base64') {
					
						line = new Buffer(line, 'base64');

					} else {
					
						line += '\n';

					}

					this._currentPart['stream'].write(line);
					this._currentPart['length'] += line.length;

				}
		
		};
	
	});

	this.on('finish', function() {

		if(this.body && this.body['stream']) {

			this.body['stream'] = fs.createReadStream(this.body['stream']['path']);
		
		}

		this._currentPart = getBlankPart();

		this.multiparts.forEach(function(item, index) {
		
			item['stream'] = fs.createReadStream(item['stream'].path);

		});

		this.emit('parseEnd', {
			header: this.header,
			body: this.body,
			multiparts: this.multiparts
		});

		this._status = 4;

	});

};

Parser.prototype = Object.create(stream.Transform.prototype, {
	constructor: { value: Parser }
});

Parser.prototype._transform = function(chunk, encoding, callback) {

	var data = chunk.toString();

	if(this._lastLineData) {

		data = this._lastLineData+data;

	}

	var lines = data.split('\n');

	this._lastLineData = lines.splice(lines.length-1, 1)[0]

	var parent = this;

	lines.forEach(function(item) {

		parent.push(item.trim());

	});
	
	callback();

};

Parser.prototype._flush = function(callback) {

	if(this._lastLineData) {
		
		this.push(this._lastLineData);

	}
	
	this._lastLineData = null;

	callback();

};

Parser.prototype._parseHeader = function(line) {

	var headerMatch = line.match(/^([A-Za-z-]+): ?([^$]+)$/);

	if(headerMatch) {

		var key = headerMatch[1].toLowerCase();
		var rawValue = headerMatch[2];

		var value = '';
		var lastEndIndex = 0;
		var mimeWordMatch = null;
		var mimeWordExp = new RegExp(/=\?UTF-8\?[BbQq]\?[^\?]+\?=/g);

		while(mimeWordMatch = mimeWordExp.exec(rawValue)) {

			if(mimeWordMatch.index > lastEndIndex) {

				value += rawValue.substr(lastEndIndex, mimeWordMatch.index-lastEndIndex);
	
			}

			value += mimelib.decodeMimeWord(mimeWordMatch[0]);

			lastEndIndex += mimeWordMatch[0].length;

		}

		if(lastEndIndex < rawValue.length) {

			value += rawValue.substr(lastEndIndex);
		
		}

		this._currentHeader = [key, value];

		return true;

	}

	match = line.match(/boundary="([^"]+)"/);

	if(match) {

		this._boundaries.push('--'+match[1]);
		this._boundaries.push('--'+match[1]+'--');

	}

	this._currentHeader = [ , line];

	return false;

};

module.exports = Parser;
