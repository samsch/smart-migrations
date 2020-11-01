'use strict';

const replaceAll = require('string.prototype.replaceall');

function getRunnables(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}
	if (typeof raw === 'function') {
		return [raw];
	}
	return raw.split('|');
}

/**
 *
 * @param String str
 * @param {*} fillers
 */
function fillTemplates(str, fillers) {
	return replaceAll(str, /\{\{(?:[^}]+)\}\}/g, original => {
		if (!fillers[original]) {
			const availableString = Object.entries(fillers).map(([name, value]) => {
				return `"${name}" (value: '${value}')`;
			});
			throw new Error(
				`Tried to non-existing template var: {${original}}.
Available Template vars: ${availableString.join(', ')}`,
			);
		}
		return fillers[original];
	});
}

// input like -> arguments
// users.id -> 'users.id'
// id,name -> ['id', 'name']
// {{columnName}} -> 'id'
// raw(CURRENT_TIMESTAMP) -> knex.raw('CURRENT_TIMESTAMP')
// raw("{{columnName}}" + 1) -> knex.raw('"id" + 1')
function parseArgument(knex, arg, fillers) {
	const raw = /^raw\((.+)\)$/g.exec(arg);
	if (raw) {
		return knex.raw(raw[1]);
	}
	const array = arg.split(',');
	if (array.length > 1) {
		return array.map(str => fillTemplates(str, fillers));
	}
	return fillTemplates(arg, fillers);
}

// runnable: function or
// "increments"
// "references:users.id"
// "unique:id,name:users_id_name_idx"
// "defaultsTo:raw(CURRENT_TIMESTAMP)"
function handleColumnType(knex, table, isFirstRunnable, runnable, fillers) {
	if (typeof runnable === 'function') {
		return runnable(table, fillers.columnName, { ...fillers, knex });
	}
	const [callable, ...args] = runnable.split(':');
	const parsedArguments = args.map(arg => parseArgument(knex, arg, fillers));
	if (isFirstRunnable) {
		return table[callable](
			fillers.columnName,
			...parsedArguments,
		).notNullable();
	}
	return table[callable](...parsedArguments);
}

module.exports = function easyTable(knex, definition, table, tableName) {
	const specialColumns = [];
	Object.entries(definition).forEach(([columnName, rawColumnData]) => {
		if (/^\$.+/.test(columnName)) {
			specialColumns.push(rawColumnData.up);
			return;
		}
		const runnables = getRunnables(rawColumnData);
		runnables.reduce((columnBuilder, runnable, index) => {
			if (index !== 1 && typeof runnables[0] === 'function') {
				throw new Error('Custom column function did not return table builder!');
			}
			return handleColumnType(knex, columnBuilder, index === 0, runnable, {
				tableName,
				columnName,
			});
		}, table);
	});
	return specialColumns;
};
