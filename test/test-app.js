const start = process.hrtime();
const fastBoot = require('../');
const fs = require('fs');

let version = '0.0.1';
let command;
if (process.argv.length > 2) {
	version = process.argv[2];
}

if (process.argv.length > 3) {
	command = process.argv[3];
}

const statusLog = [];
fastBoot.start({
	cacheKiller: version,
	statusCallback: function (message) {
		statusLog.push(message);
	},
});

const orig = {};

orig.readFileSync = fs.readFileSync;
let readFileSyncCount = 0;
fs.readFileSync = function (path, opts) {
	readFileSyncCount++;
	return orig.readFileSync(path, opts);
};

orig.existsSync = fs.existsSync;
let existsSyncCount = 0;
fs.existsSync = function (path) {
	existsSyncCount++;
	return orig.existsSync(path);
};

if (command === 'loadExpress') {
	require('express')();
	fastBoot.saveCache(sendStatus);
} else if (command === 'loadExpressAndProjectModule') {
	require('./test-module');
	require('express')();
	fastBoot.saveCache(sendStatus);
} else if (command === 'loadExpressAndSaveStartup') {
	require('express')();
	fastBoot.saveStartupList(function () {
		fastBoot.saveCache(sendStatus);
	});
} else if (command === 'loadExpressAndBrowserify') {
	require('express')();
	require('browserify');
	fastBoot.saveCache(sendStatus);
}

function sendStatus(err) {
	if (err) {
		console.log(err);
	}

	const stats = fastBoot.stats();
	if (process.send) {
		process.send({
			readFileSyncCount: readFileSyncCount,
			existsSyncCount: existsSyncCount,
			loadingTime: process.hrtime(start),
			cacheHit: stats.cacheHit,
			cacheMiss: stats.cacheMiss,
			notCached: stats.notCached,
			loadingStats: stats.loading,
			statusLog: statusLog,
		});
	} else {
		console.log({
			readFileSyncCount: readFileSyncCount,
			existsSyncCount: existsSyncCount,
			loadingTime: process.hrtime(start),
			cacheHit: stats.cacheHit,
			cacheMiss: stats.cacheMiss,
			notCached: stats.notCached,
			loadingStats: stats.loading,
			statusLog: statusLog,
		});
	}
}
