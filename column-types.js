'use strict';

const { timestamps } = require('./timestamps');

module.exports = {
	id_uuid(table, name, { knex }) {
		return table.uuid(name).primary().defaultTo(knex.raw('uuid_generate_v4()'));
	},
	id_bigint:
		'specificType:raw(bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY)',
	id_int: 'specificType:raw(int PRIMARY KEY GENERATED ALWAYS AS IDENTITY)',
	bigint_ref(ref, shouldNotGet) {
		if (shouldNotGet) {
			throw new Error(
				"bigint_ref needs to be called with your reference first bigint_ref('users.id')",
			);
		}
		return `bigInteger|references:${ref}`;
	},
	int_ref(ref, shouldNotGet) {
		if (shouldNotGet) {
			throw new Error(
				"int_ref needs to be called with your reference first int_ref('users.id')",
			);
		}
		return `integer|references:${ref}`;
	},
	timestamps: timestamps.easyTableColumns,
};
