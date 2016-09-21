#!/usr/bin/node

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

let filename = 'fixtures.json';
let outDir = path.join('out', '%FORMAT%');

const formats = fs.readdirSync(path.join(__dirname, 'formats')).map(file => file.replace(/\.js$/, ''));

const {argv, options} = require('node-getopt').create([
    ['f' , 'format=ARG', `\t(required)\n\t\tSpecifies output format.\n\t\tPossible arguments: "${formats.join('", "')}"\n`],
    ['i' , 'input=ARG+', `\t(optional, may be specified multiple times)\n\t\tSpecifies input filenames. If the first is not a JSON file, import all using the format\n\t\tspecified in --format.\n\t\tDefault: "${filename}\n"`],
    ['d' , 'outdir=ARG', `\t(optional)\n\t\tSpecifies the output directory. "%FORMAT%" gets replaced by the used output format.\n\t\tDefault: "${outDir}"\n`],
    ['h' , 'help', '\n\t\tDisplay this help.']
]).bindHelp().parseSystem();

if (!options.format || formats.indexOf(options.format) == -1)
    die("Invalid output format. Please specify --format. For help, use --help.");

if (!options.input || options.input.length == 0)
    options.input = [filename];

if (options.outdir)
    outDir = options.outdir;

const formatter = require(path.join(__dirname, 'formats', `${options.format}.js`));

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

    const localOutDir = outDir.replace(/%FORMAT%/g, options.format);
    mkdirp(localOutDir, (mkdirpError) => {
        if (mkdirpError) {
            die(`Could not create directory "${localOutDir}", exiting.`, mkdirpError);
        }

        console.log(`Handling ${options.format} formatting...`);

        formatter.export(manufacturers, fixtures, localOutDir);
    });
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

    const localOutDir = outDir.replace(/%FORMAT%/g, options.format);
    mkdirp(localOutDir, (mkdirpError) => {
        if (mkdirpError) {
            die(`Could not create directory "${localOutDir}", exiting.`, mkdirpError);
        }

        const promises = fileContents.map((file) => formatter.import(file.contents, file.name));

        Promise.all(promises).then((objects) => {
            const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
            const outFile = path.join(localOutDir, `import_${timestamp}.json`);

            const combinedObject = {
                "manufacturers": {},
                "fixtures": []
            };
            for (const obj of objects) {
                Object.assign(combinedObject.manufacturers, obj.manufacturers);
                combinedObject.fixtures = combinedObject.fixtures.concat(obj.fixtures);
            }

            let outStr = JSON.stringify(combinedObject, null, 4);

            // make arrays fit in one line
            outStr = outStr.replace(/^( +)"(range|dimensions|degreesMinMax)": \[\n((?:.|\n)*?)^\1\]/mg, (match, spaces, key, values) => {
                return `${spaces}"${key}": [` + JSON.parse('[' + values + ']').join(', ') + ']';
            });

            fs.writeFile(outFile, outStr, (writeError) => {
                if (writeError)
                    die(`Error writing to file "${outFile}", exiting.`, writeError);

                console.log(`File "${outFile}" successfully written.`);

                if (outStr.includes('warning'))
                    console.log('Please check for warnings using a text editor.');
            });
        });
    });
}


function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}