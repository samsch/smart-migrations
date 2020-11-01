'use strict';

const path = require('path');

module.exports = {
	client: 'pg',
	connection: {
		host: 'localhost',
		port: 54326,
		database: 'testuser',
		user: 'testuser',
		password: 'testuser',
	},
	migrations: {
		directory: path.resolve(__dirname, 'tests/migrations'),
		stub: path.resolve(__dirname, 'migrations.stub.js'),
	},
};
