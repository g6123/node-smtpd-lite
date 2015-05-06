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

	var lines = data.split('\n');

	this._lastLineData = lines.splice(lines.length-1, 1)[0]

	var parent = this;

	lines.forEach(function(item) {

		parent.push(item.trim());

	});
	
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
