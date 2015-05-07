var Iconv = require('iconv').Iconv;

try {

	var charsetDetector = require('node-icu-charset-detector');

} catch(error) {

	var charsetDetector = null;

}

var Logger = require('./logger.js');

var IconvWrapper = function(config) {

	this._logger = Logger(config['logLevel'], config['logFile']);
	this.default = config['defaultCharset'];

};

IconvWrapper.prototype.convert = function(from, to, buffer) {

	if(!from) {

		return this.autoConvert(to, buffer);
	
	}

	from = this._bugFix(from);
	to = this._bugFix(to);

	var iconv = new Iconv(from, to+'//TRANSLIT//IGNORE');

	try {
	
		return iconv.convert(buffer);

	} catch(error) {

		this._logger.debug("   iconv: Couldn't correctly decode the input buffer");

		return buffer;
	
	}

};

IconvWrapper.prototype.autoConvert = function() {

	if(arguments.length >= 2) {

		var to = arguments[0];
		var buffer = arguments[1];

	} else {
	
		var to = 'UTF-8';
		var buffer = arguments[0];

	}

	var from = this._detect(buffer);

	return this.convert(from, to, buffer);

};

IconvWrapper.prototype._detect = function(sample) {

	if(charsetDetector) {

		var charset = charsetDetector.detectCharset(sample);

		if(charset) {

			this._logger.debug("   iconv: Charset detected as '"+charset+"' with "+charset.confidence+'% confidence');

			if(charset.confidence < 20) {

				charset = this.default;
				this._logger.debug('   iconv: Default charset has been selected for the confidence is under 20%.');
			
			}

		} else {
		
			charset = this.default;
		
		}

		return charset;

	} else {

		return this.default;

	}

};

IconvWrapper.prototype._bugFix = function(charset) {

	switch(charset.toUpperCase()) {
	
		case 'EUC-KR':

			charset = 'CP949';
			break;

		case 'KS_C_5601-1987':

			charset = 'CP949';
			break;

		case 'ISO-8859-8-I':

			charset = 'ISO-8859-8';
			break;

	}

	return charset;

};

module.exports = IconvWrapper;
