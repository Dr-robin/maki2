'use strict';

var fs = require('fs');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var request = require('request');
var mysql = require('mysql');
var maki = require('maki-template');
var app = express();
var langs = {};
var langList = [];

global.async = require('async');
global.validator = require('validator');
global.db = mysql.createPool(require('../config.json').mariadb);

request('https://spreadsheets.google.com/feeds/cells/1qT9wXeR6W7BzE6e7MjGqMH5itjIU_DldKvB4uzJt7G0/1/public/basic?alt=json', function(err, data, body) {
	if(!err && data.statusCode == 200) {
		var langTag = {};
		body = JSON.parse(body).feed.entry;
		for(let i = 0; i < body.length; i++) {
			if(body[i].title.$t.substr(1) == '1') {
				langTag[body[i].title.$t.substr(0, 1)] = body[i].content.$t;
				langs[body[i].content.$t] = {};
				langList.push(body[i].content.$t);
			}
			else {
				if(body[i].title.$t.substr(0, 1) == 'A') {
					langTag[body[i].title.$t.substr(1)] = body[i].content.$t;
				}
				else {
					langs[langTag[body[i].title.$t.substr(0, 1)]][langTag[body[i].title.$t.substr(1)]] = body[i].content.$t;
				}
			}
		}

	}
	else {
		console.error('Failed to update language file');
	}
});

maki.init(app);
app.set('trust proxy', true);
app.set('view engine', 'maki');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(require("cookie-parser")());
app.use((req, res, next) => {
	res.result = (skin, data) => {
		function i18n(id) {
			return langs[langList.indexOf(req.cookies.language) != -1 ? req.cookies.language : "noLang"][id] || langs[(req.acceptsLanguages(langList) || "noLang")][id] || langs["ko-KR"][id] || '#' + id;
		}
		if(req.get('X-App-ID')) {
			res.json(data);
		}
		else {
			res.render(skin, {data: data, i18n: i18n});
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