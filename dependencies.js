'use strict';

var func = {};
func.$body = (req, next) => {
	next(null, req.body);
};


module.exports = func;