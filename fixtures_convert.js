#!/usr/bin/node

'use strict';

let filename = 'fixtures.json';

const formats = ['ecue', 'qlcplus'];

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

let outDir = ['out', '%FORMAT%'].join(path.sep);

const {argv, options} = require('node-getopt').create([
    ['o' , 'format=ARG', `Required. Specifies output format. Possible arguments: "${formats.join('", "')}"`],
    ['f' , 'filename=ARG', `Specifies input filename. Default: "${filename}"`],
    ['d' , 'outdir=ARG', `Specifies the output directory. "%FORMAT%" gets replaced by the used output format. Default: "${outDir}"`],
    ['h' , 'help', 'Display this help.']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

if (!options.format || formats.indexOf(options.format) == -1) {
    die("Invalid output format. Please specify --format. For help, use --help.");
}

if (options.filename) {
    filename = options.filename;
}
if (options.outdir) {
    outDir = options.outdir;
}

let manufacturers;
let fixtures;

fs.access(filename, fs.constants.R_OK, (readError) => {
    if (readError) {
        die(`Can't read file "${filename}", exiting.`);
    }

    try {
        let json = JSON.parse(fs.readFileSync(filename, 'utf8'));
        manufacturers = json.manufacturers;
        fixtures = json.fixtures;
    }
    catch (parseError) {
        die(`Malformed JSON file "${filename}"! The error is attached below:\n`, parseError);
    }

    const localOutDir = outDir.replace(/%FORMAT%/g, options.format);
    mkdirp(localOutDir, (mkdirpError) => {
        if (mkdirpError) {
            die(`Could not create directory "${localOutDir}", exiting.`, mkdirpError);
        }

        console.log(`Handling ${options.format} formatting...`);

        let formatter = require(['.', 'formats', `${options.format}.js`].join(path.sep));
        formatter.format(manufacturers, fixtures, localOutDir);
    });
});



function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}