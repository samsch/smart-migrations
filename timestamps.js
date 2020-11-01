'use strict';

const base = {
	createdAt: {
		column: (table, knex) => {
			return table
				.timestamp()
				.notNullable()
				.defaultTo(knex.raw('CURRENT_TIMESTAMP'));
		},
		up: async ({ knex, tableName, columnName }) => {
			return knex.raw(`
CREATE TRIGGER "trigger_no_update_created_at_${tableName}"
	BEFORE UPDATE ON "${tableName}"
	FOR EACH ROW
	WHEN (OLD."${columnName}" IS DISTINCT FROM NEW."${columnName}")
	EXECUTE FUNCTION raise_exception();
`);
		},
		// Keeping columnName for parity with up()
		// eslint-disable-next-line no-unused-vars
		down: async ({ knex, tableName, columnName }) => {
			knex.raw(
				`DROP TRIGGER "trigger_no_update_created_at_${tableName}" ON "${tableName}";`,
			);
		},
	},
	updatedAt: {
		column: (table, knex) => {
			return table
				.timestamp()
				.notNullable()
				.defaultTo(knex.raw('CURRENT_TIMESTAMP'));
		},
		up: async ({ knex, tableName, columnName }) => {
			return knex.raw(`
CREATE FUNCTION function_on_update_set_timestamp_${tableName}() RETURNS trigger AS $$
	BEGIN
		NEW."${columnName}" := CURRENT_TIMESTAMP;
		RETURN NEW;
	END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trigger_on_update_set_timestamp_${tableName}"
	BEFORE UPDATE ON "${tableName}"
	FOR EACH ROW
	EXECUTE FUNCTION function_on_update_set_timestamp_${tableName}();
`);
		},
		// Keeping columnName for parity with up()
		// eslint-disable-next-line no-unused-vars
		down: async ({ knex, tableName, columnName }) => {
			return knex.raw(`
DROP TRIGGER "trigger_on_update_set_timestamp_${tableName}" ON "${tableName}";
DROP FUNCTION function_on_update_set_timestamp_${tableName};
`);
		},
	},
};

const timestamps = {
	columns: (table, knex) => {
		base.createdAt.column(table, knex);
		base.updatedAt.column(table, knex);
	},
	// prettier-ignore
	up: async ({ knex, tableName, createAtColumnName, updatedAtColumnName }) => {
		await base.createdAt.up({ knex, tableName, columnName: createAtColumnName });
		await base.updatedAt.up({ knex, tableName, columnName: updatedAtColumnName });
	},
	// prettier-ignore
	down: async ({ knex, tableName, createAtColumnName, updatedAtColumnName }) => {
		await base.updatedAt.down({ knex, tableName, columnName: updatedAtColumnName });
		await base.createdAt.down({ knex, tableName, columnName: createAtColumnName });
	},
};

module.exports = {
	...base,
	timestamps: {
		...timestamps,
		easyTableColumns: ({
			createAtColumnName = 'created_at',
			updatedAtColumnName = 'updated_at',
		} = {}) => ({
			[createAtColumnName]: ['timestamp', 'defaultTo:raw(CURRENT_TIMESTAMP)'],
			[updatedAtColumnName]: ['timestamp', 'defaultTo:raw(CURRENT_TIMESTAMP)'],
			// prettier-ignore
			$timestamps: {
				up:   (knex, tableName) => timestamps.up({   knex, tableName, createAtColumnName, updatedAtColumnName }),
				down: (knex, tableName) => timestamps.down({ knex, tableName, createAtColumnName, updatedAtColumnName }),
			},
		}),
	},
};
