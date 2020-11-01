'use strict';

const path = require('path');
const assureArray = require('assure-array');
const Promise = require('bluebird');
const makeEasyTable = require('./easy-table');

function getSpecialColumns(easyTable) {
	return Object.entries(easyTable)
		.filter(([columnName]) => /^\$.+/.test(columnName))
		.map(entry => entry[1]);
}

function checkMigrationInput(input) {
	const { tables, up, down, easyTable } = input;
	if (easyTable) {
		if (up || down) {
			throw new Error(
				'When an easyTable is defined, you may not include "up" or "down".',
			);
		}
		if (
			typeof tables !== 'string' &&
			!Array.isArray(tables) &&
			tables.length !== 1
		) {
			throw new Error(
				`The "tables" property must be set to a string table name or array with a
single table name. Received ${JSON.stringify(tables)}.`,
			);
		}
		return;
	}
	if (typeof tables !== 'string' && !Array.isArray(tables)) {
		throw new Error(
			`The "tables" property must be set. Should be an array of table names, or can be
just the string name of one.
Expected array or string, got ${JSON.stringify(tables)}`,
		);
	}
	if (typeof up !== 'function') {
		throw new Error(
			'Missing "up" property. Should be a function taking (knex) as it\'s argument.',
		);
	}
	const tableNames = assureArray(tables);
	if (typeof down !== 'function' && tableNames.length === 0) {
		throw new Error(
			'The tables array is empty, so you must provide a "down" function in the migration',
		);
	}
}

function createEasyTable(knex, tableName, easyTable) {
	return knex.schema.createTable(tableName, table => {
		makeEasyTable(knex, easyTable, table, tableName);
	});
}

function smartMigrations(migrationInput) {
	const migrations = assureArray(migrationInput);
	return {
		up(knex) {
			return Promise.each(migrations, (migrationObject, tableIndex) => {
				checkMigrationInput(migrationObject, tableIndex);
				const { tables, up, easyTable } = migrationObject;
				const tableNames = assureArray(tables);
				if (easyTable) {
					return Promise.try(() => {
						return createEasyTable(knex, tableNames[0], easyTable);
					}).then(() => {
						const specialColumns = getSpecialColumns(easyTable);
						return Promise.each(specialColumns, specialColumn => {
							return specialColumn.up(knex, tableNames[0]);
						});
					});
				}
				const tableNamesUsed = {};
				let ignoringNextTable = false;
				function ignoreNextTable() {
					ignoringNextTable = true;
				}
				function knexQueryListener({ sql }) {
					if (ignoringNextTable) {
						return;
					}
					const expressedCreateTable = /create table "([\w.]+)"/.exec(sql);
					if (expressedCreateTable && expressedCreateTable[1]) {
						const tableName = expressedCreateTable[1];
						if (!tableNames.includes(tableName)) {
							let message = `Table created with unexpected table name.
Migration index: ${tableIndex} for tables: ["${tableNames.join('", "')}"]`;
							if (tableNames.length) {
								message += `
Add '${tableName}' to the "tables" array property on the migration object.`;
							} else {
								message += `
Set "${tableName}" as the "tables" property in the migration object.`;
							}
							message += `
If you want to disable the check for this table, you can call ignoreNextTable
just before you create it. ignoreNextTable is passed in the second argument to
up, like "up(knex, { ignoreNextTable })"`;
							throw new Error(message);
						}
						if (tableNamesUsed[tableName]) {
							throw new Error(
								`Already created this table! Table name: ${tableName}`,
							);
						}
						tableNamesUsed[tableName] = true;
					}
				}
				knex.on('query', knexQueryListener);
				return Promise.try(() => {
					return up(knex, { ignoreNextTable });
				})
					.then(passthrough => {
						if (Object.keys(tableNamesUsed).length !== tableNames.length) {
							const missed = tableNames.reduce((missedAcc, name) => {
								if (tableNamesUsed[name]) {
									return missedAcc;
								}
								return missedAcc.concat(name);
							}, []);
							throw new Error(
								`Table names defined that weren't created! Names: ["${missed.join(
									'", "',
								)}"]
All tables passed to tables in a migration object are expected to be created.`,
							);
						}
						return passthrough;
					})
					.finally(() => {
						knex.off('query', knexQueryListener);
					});
			});
		},
		down(knex) {
			return Promise.each(
				migrations.slice().reverse(),
				(migrationObject, tableIndex) => {
					checkMigrationInput(migrationObject);
					const { tables, down, easyTable } = migrationObject;
					const tableNames = assureArray(tables);
					const tableNamesUsed = {};

					let ignoringNextTable = false;
					function ignoreNextTable() {
						ignoringNextTable = true;
					}
					function knexQueryListener({ sql }) {
						if (ignoringNextTable) {
							return;
						}
						const expressedDropTable = /drop table (?:if exists )"([\w.]+)"/.exec(
							sql,
						);
						if (expressedDropTable && expressedDropTable[1]) {
							const tableName = expressedDropTable[1];
							if (!tableNames.includes(tableName)) {
								let message = `A table was dropped with called with an unexpected table name.
Migration index: ${tableIndex} for tables: ["${tableNames.join('", "')}"]`;
								if (tableNames.length) {
									message += `
Add '${tableName}' to the "table" array property on the migration object.`;
								} else {
									message += `
Set "${tableName}" as the \`table\` property in the migration object.`;
								}
								message += `
If you want to disable the check for this table, you can call ignoreNextTable
just before you drop it. ignoreNextTable is passed in the second argument to
down, like "down(knex, { ignoreNextTable })"`;
								throw new Error(message);
							}
							if (tableNamesUsed[tableName]) {
								throw new Error(
									`Already dropped this table! Table name: ${tableName}`,
								);
							}
							tableNamesUsed[tableName] = true;
						}
					}
					knex.on('query', knexQueryListener);
					return Promise.try(() => {
						if (easyTable) {
							const specialColumns = getSpecialColumns(easyTable);
							return Promise.each(
								// reverse is mutating, but we just made this new array anyway
								specialColumns.reverse(),
								specialColumn => {
									return specialColumn.down(knex, tableNames[0]);
								},
							);
						}
						return undefined;
					})
						.then(() => {
							if (typeof down !== 'function') {
								return Promise.each(tableNames, name => {
									tableNamesUsed[name] = true;
									if (process.env.MIGRATION_USE_DROP_IF_EXISTS === 'true') {
										return knex.schema.dropTableIfExists(name);
									}
									return knex.schema.dropTable(name);
								});
							}
							return down(knex, { ignoreNextTable });
						})
						.then(passthrough => {
							if (Object.keys(tableNamesUsed).length !== tableNames.length) {
								const missed = tableNames.reduce((missedAcc, name) => {
									if (tableNamesUsed[name]) {
										return missedAcc;
									}
									return missedAcc.concat(name);
								}, []);
								const missingString = missed.join('", "');
								throw new Error(
									`Table names defined that weren't dropped! Names: ["${missingString}"]`,
								);
							}
							return passthrough;
						})
						.finally(() => {
							knex.off('query', knexQueryListener);
						});
				},
			);
		},
	};
}

module.exports = {
	migrator: smartMigrations,
	types: require('./column-types'),
	getDefaultStubPath() {
		return path.resolve(__dirname, 'migrations.stub.js');
	},
};
