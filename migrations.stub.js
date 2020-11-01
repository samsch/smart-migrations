'use strict';

const { migrator, types } = require('@samsch/smart-migrations');

module.exports = migrator([
	{
		tables: ['tablename'],
		up: async knex => {
			await knex.schema.createTable('tablename', table => {
				table.increments('id');
				table.text('name').notNullable();
			});
		},
		// down can be a similar function, but any tables in the tables array
		// will be automaticaly dropped if you don't provide a down function.
	},
]);
