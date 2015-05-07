var stream = require('stream');

var LineStream = function() {

	stream.Transform.call(this, { objectMode: true });

};

LineStream.prototype = Object.create(stream.Transform.prototype, {
	constructor: { value: LineStream }
});

LineStream.prototype._transform = function(chunk, encoding, callback) {

	var data = chunk.toString();

	if(this._lastLineData) {

		data = this._lastLineData+data;

	}

	var lines = data.split(/\r\n|[\n\r\u0085\u2028\u2029]/g);

	this._lastLineData = lines.pop();

	lines.forEach(this.push.bind(this));

	callback();

};

LineStream.prototype._flush = function(callback) {

	if(this._lastLineData) {
		
		this.push(this._lastLineData);

	}
	
	this._lastLineData = null;

	callback();

};

module.exports = LineStream;
