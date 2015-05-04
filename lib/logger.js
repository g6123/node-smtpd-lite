var winston = require('winston');

module.exports = function(logLevel, logFile) {

	var transports = [
		new (winston.transports.Console)({ colorize: true })
	];

	if(logFile) {

		transports.push(new (winston.transports.File)({ filename: logFile }));

	}

	var logger = new (winston.Logger)({
		transports: transports,
		levels: {
			debug: 0,
			info: 1,
			warn: 2,
			error: 3
		},
		level: logLevel
	});

	return logger;

};
