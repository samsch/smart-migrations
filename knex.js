'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
const Knex = require('knex');
const config = require('./knexfile');

module.exports = Knex(config);
