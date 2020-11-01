'use strict';

const { migrator, types } = require('../../index');

module.exports = migrator([
	{
		tables: [],
		up: async knex => {
			await knex.raw(`
CREATE FUNCTION raise_exception() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'May not update created_at timestamps - on table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;`);
		},
		down: async knex => {
			await knex.raw('DROP FUNCTION raise_exception;');
		},
	},
	{
		tables: ['users'],
		up: async knex => {
			await knex.schema.createTable('users', table => {
				table.increments('id');
				table.text('name').notNullable();
			});
		},
	},
	{
		tables: [],
		up: async knex => {
			await knex('users').insert({
				name: 'Kayla',
			});
		},
		down: async knex => {
			await knex('users')
				.where({
					name: 'Kayla',
				})
				.del();
		},
	},
]);
