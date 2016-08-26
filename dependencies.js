'use strict';

var func = {};
func.$body = (req, next) => {
	next(null, req.body);
};
func.$sql = (req, next) => {
	next(null, (query, data, cb) => {
		if(!cb) {
			cb = data;
			data = [];
		}
		var sql = db.query(query, data, (err, result) => {
			if(!err) {
				cb(null, result);
			}
			else {
				console.error('SQL ERROR: ' + sql.query);
				cb(err);
			}
		});
	});
};

module.exports = func;