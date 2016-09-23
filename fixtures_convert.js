#!/usr/bin/node

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const filename = 'fixtures.json';
const outDir = path.join('out', '%FORMAT%');

const formats = fs.readdirSync(path.join(__dirname, 'formats')).map(file => file.replace(/\.js$/, ''));

const {argv, options} = require('node-getopt').create([
    ['f' , 'format=ARG', `\t(required)\n\t\tSpecifies output format.\n\t\tPossible arguments: "${formats.join('", "')}"\n`],
    ['i' , 'input=ARG+', `\t(optional, may be specified multiple times)\n\t\tSpecifies input filenames. If the first is not a JSON file, import all using the format\n\t\tspecified in --format.\n\t\tDefault: "${filename}"\n`],
    ['o' , 'output=ARG', `\t(optional)\n\t\tSpecifies the output directory and filename. The following placeholders will be replaced:\n\t\t  %FORMAT%        output format (-f parameter)\n\t\t  %MANUFACTURER%  manufacturer name (spaces replaced with dashes)\n\t\t  %FIXTURE%       fixture name (spaces replaced with dashes)\n\t\t  %TIMESTAMP%     the current timestamp\n\t\tNot all combinations may make sense, e.g. qlcplus only allows one fixture per file.\n\t\tDefault: "${outDir}${path.sep}[format dependent]"\n`],
    ['h' , 'help', '\n\t\tDisplay this help.']
]).bindHelp().parseSystem();

if (!options.format || formats.indexOf(options.format) == -1)
    die("Invalid output format. Please specify --format. For help, use --help.");

const formatter = require(path.join(__dirname, 'formats', `${options.format}.js`));

if (!options.input || options.input.length == 0)
    options.input = [filename];

if (options.input[0].endsWith('.json')) {
    handleExport();
}
else {
    handleImport();
}

function handleExport() {
    if (!formatter.export)
        die(`Export to "${options.format}" not implemented yet.`);

    let imports = options.input.map(function(file) {
        try {
            return fs.realpathSync(file);
        }
        catch (realpathError) {
            die(`realpath failed for file "${file}", exiting.`, realpathError);
        }
    });
    
    let manufacturers = {};
    let fixtures = [];

    let i = 0;
    while (i < imports.length) {
        let str = '';
        try {
            str = fs.readFileSync(imports[i], 'utf8');
        }
        catch (readError) {
            die(`Can't read file "${imports[i]}", exiting. The error is attached below:\n`, readError); // '
        }

        let importBasePath;
        try {
            importBasePath = path.dirname(fs.realpathSync(imports[i])); // try
        }
        catch (realpathError) {
            die(`realpath failed for file "${imports[i]}", exiting.`, realpathError);
        }

        // read JSON
        let parsedJSON = {};
        try {
            parsedJSON = JSON.parse(str);
        }
        catch (parseError) {
            die(`Malformed JSON file "${imports[i]}", exiting. The error is attached below:\n`, parseError);
        }

        if (parsedJSON.imports) {
            for (const newImport of parsedJSON.imports) {
                const absPath = path.isAbsolute(newImport) ? newImport : path.normalize(path.join(importBasePath, newImport));
                
                if (imports.indexOf(absPath) == -1) {
                    // only if not already imported
                    imports.push(absPath);
                }
            }
        }

        Object.assign(manufacturers, parsedJSON.manufacturers);
        fixtures = fixtures.concat(parsedJSON.fixtures);

        i++;
    }


    if (!options.output)
        options.output = path.join(outDir, formatter.defaultFileName);
    options.output = options.output.replace(/%FORMAT%/g, options.format);

    console.log(`Handling ${options.format} formatting...`);
    formatter.export(manufacturers, fixtures, options.output);
}

function handleImport() {
    if (!formatter.import)
        die(`Import from "${options.format}" not implemented yet.`);

    let fileContents = [];
    for (const file of options.input) {
        try {
            fileContents.push({
                "name": file,
                "contents": fs.readFileSync(file, 'utf8')
            });
        }
        catch (readError) {
            die(`Can't read file "${file}", exiting. The error is attached below:\n`, readError); // '
        }
    }

    if (!options.output)
        options.output = path.join(outDir, 'import_' + formatter.defaultFileName);
    options.output = options.output.replace(/%FORMAT%/g, options.format);

    const promises = fileContents.map((file) => formatter.import(file.contents, file.name));
    Promise.all(promises).then((objects) => {
        const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
        options.output = options.output.replace(/%TIMESTAMP%/g, timestamp);

        const combinedObject = {
            "manufacturers": {},
            "fixtures": []
        };
        for (const obj of objects) {
            Object.assign(combinedObject.manufacturers, obj.manufacturers);
            combinedObject.fixtures = combinedObject.fixtures.concat(obj.fixtures);
        }

        let outputfiles = [];
        if (options.output.includes('%FIXTURE%')) {
            for (const fix of combinedObject.fixtures) {
                if (!combinedObject.manufacturers[fix.manufacturer]) {
                    combinedObject.manufacturers[fix.manufacturer] = {
                        "name": fix.manufacturer
                    };
                }

                let obj = {
                    "manufacturers": {},
                    "fixtures": [fix]
                };

                const filename = options.output
                    .replace(/%MANUFACTURER%/g, combinedObject.manufacturers[fix.manufacturer].name.replace(/\s+/g, '-'))
                    .replace(/%FIXTURE%/g, fix.name.replace(/\s+/g, '-'));
                
                outputfiles.push({
                    "filename": filename,
                    "data": obj
                });
            }
        }
        else if (options.output.includes('%MANUFACTURER%')) {
            for (let man in combinedObject.manufacturers) {
                if (!combinedObject.manufacturers[man].name)
                    combinedObject.manufacturers[man].name = man;

                let obj = {
                    "manufacturers": {},
                    "fixtures": []
                };
                obj.manufacturers[man] = combinedObject.manufacturers[man];

                for (const fix of combinedObject.fixtures) {
                    if (fix.manufacturer == man) {
                        obj.fixtures.push(fix);
                    }
                }

                const filename = options.output.replace(/%MANUFACTURER%/g,
                    combinedObject.manufacturers[man].name.replace(/\s+/g, '-'));

                outputfiles.push({
                    "filename": filename,
                    "data": obj
                });
            }
        }
        else {
            outputfiles.push({
                "filename": options.output,
                "data": combinedObject
            });
        }

        for (const outFile of outputfiles) {
            let outStr = JSON.stringify(outFile.data, null, 4);

            // make arrays fit in one line
            outStr = outStr.replace(/^( +)"(range|dimensions|degreesMinMax)": \[\n((?:.|\n)*?)^\1\]/mg, (match, spaces, key, values) => {
                return `${spaces}"${key}": [` + JSON.parse('[' + values + ']').join(', ') + ']';
            });

            mkdirp(path.dirname(outFile.filename), (mkdirpError) => {
                if (mkdirpError)
                    die(`Could not create directory "${path.dirname(outFile.filename)}", exiting.`, mkdirpError);
                
                fs.writeFile(outFile.filename, outStr, (writeError) => {
                    if (writeError)
                        die(`Error writing to file "${outFile.filename}", exiting.`, writeError);

                    console.log(`File "${outFile.filename}" successfully written.`);

                    if (outStr.includes('warning'))
                        console.log('Please check for warnings using a text editor.');
                });
            });
        }
    });
}


function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}