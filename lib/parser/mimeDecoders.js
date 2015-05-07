var Iconv = require('../iconv.js');

var SkippingDecoder = require('./SkippingDecoder.js');

var mimeDecoders = {
	init: function(config) {

		this._iconv = new Iconv(config);

	},

	decodeMimeWord: function(word) {

		var wordExp = new RegExp(/=\?([A-Za-z0-9-_]+)\?([BbQq]+)\?([^\?]+)\?=/);
		word = word.match(wordExp);

		var charset = word[1];

		if(charset.toUpperCase() == 'EUC-KR') {

			charset = 'CP949';
		
		}

		var type = word[2].toLowerCase();
		var string = word[3];

		if(type == 'b') {

			return mimeDecoders.decodeBase64String(string, charset);

		}
		
		if(type == 'q') {

			return mimeDecoders.decodeQuotedString(string, charset);
		
		}

	},

	decodeBase64String: function(string, charset) {

		var buf = new Buffer(string, 'base64');
		return mimeDecoders._iconv.convert(charset, 'UTF-8', buf).toString();

	},

	decodeQuotedString: function(string, charset) {

		var parent = mimeDecoders;

		var QuoteDecoder = new SkippingDecoder(/(=[0-9A-Fa-f]{2})+/g, function(data) {

			var buf = new Buffer(data.split('=').join(''), 'hex');
			return parent._iconv.convert(charset, 'UTF-8', buf).toString();

		});

		return QuoteDecoder.decode(string).split('_').join(' ');

	}
};

module.exports = mimeDecoders;
