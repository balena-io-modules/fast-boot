'use strict';
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const childProcess = require('child_process');
const nodeModuleCache = require('../');
const util = require('util');

describe('fast-boot', function () {
	beforeEach(function () {
		deleteCacheFile();
		deleteStartupFile();
	});

	it('should not prevent loading NPM modules', function (done) {
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);

			expect(data.readFileSyncCount).to.be.above(0);
			expect(data.cacheMiss).to.be.above(0);
			expect(data.cacheHit).to.be.equal(0);
			expect(data.loadingStats.startupFile).to.match(
				/^startup file not found at/,
			);
			expect(data.loadingStats.cacheFile).to.match(/^cache file not found at/);

			const moduleLocationsCache = loadModuleLocationsCache();
			expect(moduleLocationsCache).to.satisfy(noNonNodeModulesPaths);
			done();
		});
	});

	it('should not search for files again on second invocation of node', function (done) {
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);

			const child2 = runChild('1.0.0', 'loadExpress');
			child2.on('message', function (data2) {
				logStuff('second', '1.0.0', data2);
				expect(data.cacheMiss).to.be.above(0);
				expect(data.cacheHit).to.be.equal(0);
				expect(data2.cacheMiss).to.be.equal(0);
				expect(data2.cacheHit).to.be.above(0);
				expect(data2.loadingStats.startupFile).to.match(
					/^did not attempted to load startup file/,
				);
				expect(data2.loadingStats.cacheFile).to.match(
					/^loaded cache file from/,
				);

				done();
			});
		});
	});

	it('should not cache if using a different cache killer (the version parameter)', function (done) {
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);

			const child2 = runChild('1.0.1', 'loadExpress');
			child2.on('message', function (data2) {
				logStuff('second', '1.0.1', data2);
				expect(data.cacheMiss).to.be.above(0);
				expect(data.cacheHit).to.be.equal(0);
				expect(data2.cacheMiss).to.be.above(0);
				expect(data2.cacheHit).to.be.equal(0);

				done();
			});
		});
	});

	it('should not cache project modules', function (done) {
		const child = runChild('1.0.0', 'loadExpressAndProjectModule');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);

			const child2 = runChild('1.0.0', 'loadExpressAndProjectModule');
			child2.on('message', function (data2) {
				logStuff('second', '1.0.0', data2);
				expect(data.cacheMiss).to.be.above(0);
				expect(data.cacheHit).to.be.equal(0);
				expect(data2.cacheMiss).to.be.equal(0);
				expect(data2.cacheHit).to.be.above(0);

				const moduleLocationsCache = loadModuleLocationsCache();
				expect(moduleLocationsCache).to.satisfy(noNonNodeModulesPaths);
				done();
			});
		});
	});

	it('should load module locations from startup list', function (done) {
		const child = runChild('1.0.0', 'loadExpressAndSaveStartup');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);
			deleteCacheFile();

			const child2 = runChild('1.0.0', 'loadExpress');
			child2.on('message', function (data2) {
				logStuff('second', '1.0.0', data2);
				expect(data.cacheMiss).to.be.above(0);
				expect(data.cacheHit).to.be.equal(0);
				expect(data2.cacheMiss).to.be.equal(0);
				expect(data2.cacheHit).to.be.above(0);

				done();
			});
		});
	});

	it('should load base modules from startup, adding more to cache if needed', function (done) {
		const child = runChild('1.0.0', 'loadExpressAndSaveStartup');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);
			deleteCacheFile();

			const child2 = runChild('1.0.0', 'loadExpress');
			child2.on('message', function (data2) {
				logStuff('second', '1.0.0', data2);
				expect(data.cacheMiss).to.be.above(0);
				expect(data.cacheHit).to.be.equal(0);
				expect(data2.cacheMiss).to.be.equal(0);
				expect(data2.cacheHit).to.be.above(0);

				const child3 = runChild('1.0.0', 'loadExpressAndBrowserify');
				child3.on('message', function (data3) {
					logStuff('third', '1.0.0', data3);
					expect(data3.cacheMiss).not.to.be.equal(0);
					expect(data3.cacheHit).to.be.above(0);

					done();
				});
			});
		});
	});

	it('should recover from invalid startup file', function (done) {
		fs.writeFileSync(nodeModuleCache.DEFAULT_STARTUP_FILE, 'bla bla bla');
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);
			expect(data.readFileSyncCount).to.exist;

			done();
		});
	});

	it('should recover from invalid cache file', function (done) {
		fs.writeFileSync(nodeModuleCache.DEFAULT_CACHE_FILE, 'bla bla bla');
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);
			expect(data.readFileSyncCount).to.exist;

			done();
		});
	});

	it('should recover from startup file with wrong path', function (done) {
		fs.writeFileSync(
			nodeModuleCache.DEFAULT_STARTUP_FILE,
			JSON.stringify({
				_cacheKiller: '1.0.0',
				'express:.': 'non-existant-path',
			}),
		);
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);
			expect(data.readFileSyncCount).to.exist;

			done();
		});
	});

	it('should recover from cache file with wrong path', function (done) {
		fs.writeFileSync(
			nodeModuleCache.DEFAULT_CACHE_FILE,
			JSON.stringify({
				_cacheKiller: '1.0.0',
				'express:.': 'non-existant-path',
			}),
		);
		const child = runChild('1.0.0', 'loadExpress');
		child.on('message', function (data) {
			logStuff('first', '1.0.0', data);
			expect(data.readFileSyncCount).to.exist;

			done();
		});
	});
});

function loadModuleLocationsCache() {
	const content = fs.readFileSync(nodeModuleCache.DEFAULT_CACHE_FILE);
	return JSON.parse(content);
}

function noNonNodeModulesPaths(moduleLocationsCache) {
	const keys = Object.keys(moduleLocationsCache);
	for (const index of keys) {
		const key = keys[index];
		if (key !== '_cacheKiller') {
			if (
				moduleLocationsCache[key] &&
				moduleLocationsCache[key].indexOf('node_modules') === -1
			) {
				return false;
			}
		}
	}
	return true;
}

function runChild(version, command) {
	return childProcess.fork('./test/test-app.js', [version, command]);
}

function hrTimeToSecString(hrTime) {
	return hrTime[0] + '.' + String('000000000' + hrTime[1]).slice(-9);
}

function logStuff(run, version, data) {
	console.log(
		util.format(
			'        - %s run  [%s]: %s Sec, readFileSync: %d, existsSyncCount: %d',
			run,
			version,
			hrTimeToSecString(data.loadingTime),
			data.readFileSyncCount,
			data.existsSyncCount,
		),
	);
}

function deleteCacheFile() {
	try {
		fs.unlinkSync(nodeModuleCache.DEFAULT_CACHE_FILE);
	} catch (e) {
		return undefined;
	}
}

function deleteStartupFile() {
	try {
		fs.unlinkSync(nodeModuleCache.DEFAULT_STARTUP_FILE);
	} catch (e) {
		return undefined;
	}
}
