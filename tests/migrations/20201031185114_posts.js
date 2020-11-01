'use strict';

const { migrator, types } = require('../../index');

module.exports = migrator([
	{
		tables: 'posts',
		up: async knex => {
			await knex.schema.createTable('posts', table => {
				table.increments('id');
				table.integer('user_id').references('users.id');
				table.text('body').notNullable();
			});
		},
	},
	{
		tables: [],
		up: async knex => {
			const kayla = await knex('users').first();
			await knex('posts').insert({
				user_id: kayla.id,
				body: "Kayla's first post!",
			});
		},
		down: async knex => {
			await knex('posts')
				.where({
					body: "Kayla's first post!",
				})
				.del();
		},
	},
]);
