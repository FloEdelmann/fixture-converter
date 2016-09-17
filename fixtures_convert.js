#!/usr/bin/node

'use strict';

let filename = 'fixtures.json';

const formats = ['ecue', 'qlcplus'];

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const extend = require('extend');

let outDir = ['out', '%FORMAT%'].join(path.sep);

const {argv, options} = require('node-getopt').create([
    ['f' , 'format=ARG', `Required. Specifies output format. Possible arguments: "${formats.join('", "')}"`],
    ['i' , 'input=ARG', `Specifies input filename. If this is not a JSON file, import it using the format speciefied in --format. Default: "${filename}"`],
    ['d' , 'outdir=ARG', `Specifies the output directory. "%FORMAT%" gets replaced by the used output format. Default: "${outDir}"`],
    ['h' , 'help', 'Display this help.']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

if (!options.format || formats.indexOf(options.format) == -1) {
    die("Invalid output format. Please specify --format. For help, use --help.");
}

if (options.input) {
    filename = options.input;
}
if (options.outdir) {
    outDir = options.outdir;
}

if (filename.endsWith('.json')) {
    handleExport();
}
else {
    handleImport();
}

function handleExport() {
    let imports = [filename];
    let manufacturers = {};
    let fixtures = [];

    let i = 0;
    while (i < imports.length) {
        // check access
        let str = '';
        try {
            str = fs.readFileSync(imports[i], 'utf8');
        }
        catch (readError) {
            die(`Can't read file "${imports[i]}", exiting. The error is attached below:\n`, readError);
        }

        // read JSON
        let parsedJSON = {};
        try {
            parsedJSON = JSON.parse(str);
        }
        catch (parseError) {
            die(`Malformed JSON file "${imports[i]}"! The error is attached below:\n`, parseError);
        }

        if (parsedJSON.imports) {
            for (let newImport of parsedJSON.imports) {
                if (imports.indexOf(newImport) == -1) {
                    // only if not already imported
                    imports.push(newImport);
                }
            }
        }

        extend(manufacturers, parsedJSON.manufacturers);
        fixtures = fixtures.concat(parsedJSON.fixtures);

        i++;
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
}

function handleImport() {
    let str = '';
    try {
        str = fs.readFileSync(filename, 'utf8');
    }
    catch (readError) {
        die(`Can't read file "${filename}", exiting. The error is attached below:\n`, readError);
    }


}


function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}