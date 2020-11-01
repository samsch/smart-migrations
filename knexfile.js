'use strict';

const path = require('path');

const useBrokenMigrations = Boolean(process.env.USE_BROKEN_MIGRATIONS);

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
		directory: path.resolve(
			__dirname,
			useBrokenMigrations ? 'tests/broken-migrations' : 'tests/migrations',
		),
		stub: path.resolve(__dirname, 'migrations.stub.js'),
	},
};
