#!/usr/bin/node

'use strict';

const cp = require('child_process');

console.log("Testing will be implemented soon. But let's try calling the diff command.");

const returnVal = cp.spawnSync('diff', ['../README.md', '../package.json'], {encoding: 'utf8'});
console.log(returnVal.output);

process.exit(0);