'use strict';

const { migrator, types } = require('@samsch/smart-migrations');

module.exports = migrator([
	{
		tables: 'users',
		easyTable: {
			id: types.id_int,

			...types.timestamps(),
		},
	},
]);
