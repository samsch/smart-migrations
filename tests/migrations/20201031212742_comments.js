'use strict';

const { migrator, types } = require('../../index');

module.exports = migrator([
	{
		tables: ['comments'],
		easyTable: {
			id: 'increments',
			user_id: 'integer|references:users.id',
			post_id: 'integer|references:posts.id',
			body: 'text',
			...types.timestamps(),
		},
		// down can be a similar function, but any tables in the tables array
		// will be automaticaly dropped if you don't provide a down function.
	},
	{
		tables: [],
		up: async knex => {
			const kayla = await knex('users').first();
			const kaylasPost = await knex('posts').first();
			await knex('comments').insert({
				user_id: kayla.id,
				post_id: kaylasPost.id,
				body: "Kayla's first comment!",
			});
			const schema = await knex('information_schema.columns')
				.select(['column_name', 'data_type', 'column_default', 'is_nullable'])
				.where({
					table_name: 'comments',
				})
				.orderBy('ordinal_position');
			const expectedDefinition = JSON.stringify([
				{
					column_name: 'id',
					data_type: 'integer',
					column_default: "nextval('comments_id_seq'::regclass)",
					is_nullable: 'NO',
				},
				{
					column_name: 'user_id',
					data_type: 'integer',
					column_default: null,
					is_nullable: 'NO',
				},
				{
					column_name: 'post_id',
					data_type: 'integer',
					column_default: null,
					is_nullable: 'NO',
				},
				{
					column_name: 'body',
					data_type: 'text',
					column_default: null,
					is_nullable: 'NO',
				},
				{
					column_name: 'created_at',
					data_type: 'timestamp with time zone',
					column_default: 'CURRENT_TIMESTAMP',
					is_nullable: 'NO',
				},
				{
					column_name: 'updated_at',
					data_type: 'timestamp with time zone',
					column_default: 'CURRENT_TIMESTAMP',
					is_nullable: 'NO',
				},
			]);
			// console.log(JSON.stringify(schema, null, 2));
			if (JSON.stringify(schema) !== expectedDefinition) {
				throw new Error('Schema did not match!');
			}
		},
		down: async knex => {
			await knex('comments')
				.where({
					body: "Kayla's first comment!",
				})
				.del();
		},
	},
]);
