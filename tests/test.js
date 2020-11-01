'use strict';

const Promise = require('bluebird');
const knex = require('../knex');

/**
 * Write tests that all table constraints and triggers correctly cause queries to throw.
 *
 * Add table structure tests to each migration
 */

Promise.try(async () => {
	const users = await knex('users');
	if (users.length !== 1 || users[0].name !== 'Kayla') {
		throw new Error('Should be a single user named Kayla! Instead got:', users);
	}
	console.log(users);
})
	.return(0)
	.catch(error => {
		console.error(error);
		return 1;
	})
	.then(code => {
		process.exit(code);
	});
