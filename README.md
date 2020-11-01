# Smart Migrator

A tool for making migrations with Knex safer, easier, and smarter!

Built with assumptions for PostgreSQL, not tested elsewhere.

Install
```bash
npm i -D @samsch/smart-migrations
```

Setup your Knexfile per normal, but you're going to want to replace the migration stub.

An example stub is provided which can be used like this:

```js
module.exports = {
  client: 'pg',
  connection: {
    ...
  },
  migrations: {
    stub: require('@samsch/smart-migrations').getDefaultStubPath(),
  }
};
```

You will probably want to create your own stub, which should include your preferred default id column type, and can include any common helpers, or better yet, a local import of them.

Example stub with big int identity column

```js
'use strict';

const { migrator, types } = require('@samsch/smart-migrations');

module.exports = migrator([
	{
		tables: '<table-name>',
		easyTable: {
			id: types.id_bigint,
			
			...types.timestamps(),
		},
	}
]);
```

You'll provide the path to the stub file as `stub` in your knexfile, like `stub: path.resolve(__dirname, 'migration-helpers/migrations.stub.js'),`.

## How it works

`migrator()` takes an array of sub-migrations. Each will be run as part of the migration file, but separately in order and reverse order.

This lets you organize up and down parts closer together for parts of your migration.

Every sub-migration object must include the `tables` property which can be an array of or a single table name string. When using easyTable, this must be a single string or array with a single string element.

The migratory will automatically call `drop table` with the table string names. For non-easyTable migrations, they are also used for some smart safe checks.

## How easyTable works

`easyTable` is designed for easy and clear single table setup. You can't make more than one table with easyTable per sub-migration. You can add more sub-migrations though!

The basic idea of `easyTable` is that you have column names as object property names, and the value can be a function, string, or array of those.

A string will be split into "runnables" on `|` characters. Providing an array of strings is the same result, but no pipe splitting.

These two are equivalent:
```js
{
	column1: 'integer|references:users.id',
	column2: ['integer', 'references:users.id'],
}
```

Each string "runnable" like `integer`, `references:users.id`, or `defaultTo:raw(CURRENT_TIMESTAMP)` will be split on `:` into the function and it's arguments. The function will be called directly on the knex column builder, and the arguments will be passed to it, after a little parsing.

The first runnable has a little bit of special behavior, since it should be a column type function. The function will have the column name passed as the first argument, and any provided arguments come after that. Additionally, `.notNullable()` will also be called on the builder before any more runnables are called (defaulting columns to `not null`). You can use `nullable` to make a nullable field.

Arguments are parsed by first checking if they match `raw(<expression>)`. If they do, then the argument will be made into `knex.raw('<expression>')`. Otherwise, commas will be split on to make arrays, or the string left over will be passed directly to the runnable. So `index:col1,col2:t1_col1_2_indx:gist` will become `columnBuilder.index(['col1', 'col2'], 't1_col1_2_indx', 'gist')` (note that this doesn't really make sense to do, since `index` isn't for building columns, but needing array arguments and multiple arguments is pretty rare among knex table builder functions).

String arguments (after being comma split) are additionally passed through a simple templating system, where `{{name}}` structures are turned into the value of `name`. Currently the only only template variables available are `{{tableName}}` and `{{columnName}}`.

Things that are not parsed include literally everything else. Numbers are not parsed, you can't get objects, etc. To handle theses, you'll use a function instead of a runnable.

Some examples of equivalent knex column builder calls.
```js
{
	id: 'increments',
}
table.increments('id').notNullable();

{
	user_id: 'integer|references:users.id|nullable',
}
table.integer('user_id').notNullable().references('users.id').nullable();
// the notNullable() is overwritten by the later nullable() call

{
	path: 'specificType:ltree|unique',
}
table.specificType('path', 'ltree').notNullable().unique();

{
	created_at: 'timestamp|defaultTo:raw(CURRENT_TIMESTAMP)'
}
table.timestamp('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
```

Instead of runnable strings, you can also pass functions, either as the whole column value, or as parts of a column array. Functions will be called with `(table, columnName, { knex, tableName, columnName })`. (Duplication of columnName is because the object gets all the `{{template}}` variable spread into it.) Usually you'll just need the first two arguments.

If your column value is an array, any functions that are not the last item in the array must return at least something truthy, and preferably the columnBuilder (`table` arg) back after calling any functions on it. `(table, columnName) => return table.integer(columnName)` is great for allowing more chaining.

Function column values can also be used for table operations which do not create a column. In this case, the property name is ignored by you ignoring the `columnName` argument.

```js
{
	user_id: 'integer|references:users.id',
	hobby_id: 'integer|references:hobbies.id',
	extra: table => {
		table.unqiue(['user_id', 'hobby_id']);
	},
}
```

The convention I've followed so far is to do any of these "extra" non-column creation actions in a final `extra` property like above.

You can of course define columns with functions normally too:
```js
{
	id: (table, name) => {
		return table.increments('name').notNullable();
	},
}
```
Just don't forget to use `notNullable` in those cases, at it can't be added by default for function columns.

## How to do "regular" migrations

Maybe easyTable isn't smart enough for something you need to do? Adding a trigger or function, creating various indexes, inserting, updating, deleting data.

You can define `up` and `down` as function properties in the sub-migration as well. These are mutually exclusive with easyTable within a single object, but you can use multiple sub-migrations to combine forces.

```js
{
	tables: ['users', 'posts'],
	up: async knex => {
		await knex.schema.createTable('users', table => {
			table.increments('id');
			table.text('name').notNullable();
		});
		await knex.schema.createTable('posts', table => {
			table.increments('id');
			table.integer('user_id').reference('users.id').notNullable();
			table.text('body').notNullable();
		});
	},
	down: async knex => {
		await knex.schema.dropTable('posts');
		await knex.schema.dropTable('users');
	},
}
```

The `tables` property is still required, and is used to avoid mistakes when creating and dropping tables. The easiest example is by simply removing the `down` function entirely. If you don't include a `down`, then Smart Migrator will assume you want the tables in the `tables` property dropped (in the correct reverse order).

But it's smarter than that too. See, if you create a table in `up` without adding it to `tables`, the migration will fail and suggest adding it. Likewise if you have a table in the `tables` array and *don't* create it, the migration will also fail with a hint.

If you do keep your `down` function, a similar check for `drop table` and `drop table if exists` calls will be made with the table names, and will similarly fail if an extra table shows up or one is missed.

You can disable this functionality for individual create or drop calls by calling `ignoreNextTable()` just before. This function is passed in a second argument object to `up` and `down` like `down: async (knex, { ignoreNextTable }) => {}`.

In all cases, when the migration fails, no changes will have occurred because Knex does migrations in a transaction by default.

Finally, if you are not creating or dropping any tables in a sub-migration, you can pass an empty array as `tables`.

```js
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
}
```

Unfortunately, the safety checks only apply to normal tables right now. Be sure to correctly drop anything else you create in your database!

## Column helpers

Warning! This stuff is very possibly going to be split into a separate package!

It's really easy to make generic column helpers for columns that you use frequently in your project, especially since you can follow your project-specific conventions.

```js
const id = 'uuid|primary|defaultTo:raw(uuid_generate_v4())';

function foreign(foreignTable) {
	return `uuid|references:${foreignTable}.id`;
}

// migrator
{
	id,
	user_id: foreign('users'),
}
```

There are even a couple built-in column helpers. (These are all very PostgreSQL specific.)

```js
const { migrator, types } = require('@samsch/smart-migrations');

{
	id1: types.id_bigint, // big int identity column
	id2: types.id_ing, // int identity column
	id3: types.id_uuid, // uuid with default generation. Requires uuid extension enabled.
	foreign1_id: types.bigint_ref('foreign1.id'), // easy references columns, can be chained with 'nullable'
	foreign2_id: types.int_ref('foreign2.id'), // Check out the source code in column-types.js
	...types.timestamps(), // Gonna need a proper explainer for this one. Check it out below!
}
```

## ...types.timestamps(),

This is a helper for creating super smart timestamp fields on a table.

It requires a function be defined first. Make this a migration in your project before any usages of `timestamps()`.

```js
'use strict';

const { migrator, types } = require('@samsch/smart-migrations');

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
]);
```

When you add `...types.timestamps()` to your easyTable, it spreads two columns onto the table. These default to `created_at` and `updated_at`. You can pass `types.timestamps({ createAtColumnName, updatedAtColumnName })` to set them differently.

It also uses some backhanded magic to attach two BEFORE UPDATE triggers to the table. The first one looks only for UPDATEs that affect `created_at`, and calls the `raise_exception` function from above to throw instead. `created_at` is effectively read-only. The second one triggers for any (other) UPDATE and sets the `updated_at` field to `CURRENT_TIMESTAMP`. It creates a new function for each table, and includes dropping that function at `down` time in migrations. (The triggers are explicitly dropped too, but they would be anyway when the tables are dropped.)

> The magic is really just an extra column that starts with a `$`, signally special handling. This is *not* part of the public api, and subject to change. Don't use column names that start with `$`.

So... use `...types.timestamps()` if you never want to worry about forgetting to updated the updated_at column ever again.

To avoid conflicts, here's what the function and trigger names that are created are called:

```js
`TRIGGER "trigger_no_update_created_at_${tableName}"`
`FUNCTION function_on_update_set_timestamp_${tableName}`
`TRIGGER "trigger_on_update_set_timestamp_${tableName}"`
```
