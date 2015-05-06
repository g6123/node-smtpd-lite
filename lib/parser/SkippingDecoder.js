var SkippingDecoder = function(pattern, decoder) {

	this.pattern = new RegExp(pattern);
	this.decoder = decoder;

};

SkippingDecoder.prototype.decode = function(data) {

	var result = '';

	var match = null;
	var lastEndIndex = -1;

	while(match = this.pattern.exec(data)) {

		if(match.index > lastEndIndex+1) {

			var skip = data.substr(lastEndIndex+1, match.index-lastEndIndex-1);
			result += skip;
			lastEndIndex += skip.length;

		}

		result += this.decoder(match[0]);

		lastEndIndex += match[0].length;

	}

	if(lastEndIndex < data.length-1) {

		result += data.substr(lastEndIndex+1);

	}

	return result;

};

module.exports = SkippingDecoder;
