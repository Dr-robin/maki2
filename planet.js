'use strict';

var fs = require('fs');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var request = require('request');
var mysql = require('mysql');
var maki = require('maki-template');
var app = express();

global.async = require('async');
global.validator = require('validator');
global.db = mysql.createPool(require('../config.json').mariadb);

maki.init(app);
app.set('trust proxy', true);
app.set('view engine', 'maki');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(require("cookie-parser")());
app.use((req, res, next) => {
	res.result = (skin, data) => {
		if(req.get('X-App-ID')) {
			res.json(data);
		}
		else {
			res.render(skin, {data: data});
		}
	};
	if((req.get('Content-Type') || '').substr(0,19) == 'multipart/form-data') {
		var form = new multiparty.Form();
		form.parse(req, (err, body, file) => {
			req.file = {};
			for(let i in body) {
				if(body.hasOwnProperty(i)) {
					req.body[i] = body[i][0];
				}
			}
			for(let j in file) {
				if(file.hasOwnProperty(j)) {
					req.file[j] = file[j][0];
				}
			}
			next();
		});
	}
	else {
		next();
	}
});

var depFunc = require('./dependencies.js');
global.page = (url, dep, worker) => {
	function route(req, res) {
		var depList = [];
		var depWorks = [];
		for(let i = 0; i < dep.length; i++) {
			depWorks.push((next) => {
				depFunc[dep[i]](req, (err, result) => {
					if(!err) {
						depList[i] = result;
						next();
					}
					else {
						next(err);
					}
				});
			});
		}
		async.parallel(depWorks, (err) => {
			if(!err) {
				depList.push((err, data, skin) => {
					if(!err) {
						res.result(skin, data);
					}
				});
				worker.apply(null, depList);
			}
			else {

			}
		});

	}
	if(!worker) {
		worker = dep;
		dep = [];
	}
	if(url.split(' ')[0].toUpperCase() == 'GET') {
		app.get(url.split(' ')[1], route);
	}
	else if(url.split(' ')[0].toUpperCase() == 'POST') {
		app.post(url.split(' ')[1], route);
	}
};

var modules = {};
fs.readdirSync('./modules').forEach(function(name) {
	if(!modules.hasOwnProperty(name)) {
		modules[name] = require(path.resolve('./modules', name));
	}
});

if(process.argv.indexOf("--static") != -1) {
	app.use("/public", express.static('public'));
}

app.listen(2525);