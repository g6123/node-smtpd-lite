var util = require('util');

module.exports = function(name) {

	var CustomError = function (msg) {

		Error.captureStackTrace(this, this.constructor);
		this.name = name;
		this.message = msg;

	};

	util.inherits(CustomError, Error);

	return CustomError;

};
