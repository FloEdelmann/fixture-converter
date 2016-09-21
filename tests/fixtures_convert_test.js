#!/usr/bin/node

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const diff = require('diff');

const assert = require('assert');

const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
const outputDir = path.join(__dirname, `out-${timestamp}`);
fs.mkdir(outputDir, (err) => {
    if (err) throw err;

    test(
        'ADJ Quad Phase HP',
        'qlcplus',
        path.join('fixtures', 'adj_quad_phase_hp.json'),
        'American-DJ-Quad-Phase-HP.qxf'
    );
    test(
        'ADJ Quad Phase HP',
        'qlcplus',
        path.join('desired_out', 'qlcplus', 'American-DJ-Quad-Phase-HP.qxf'),
        'American-DJ-Quad-Phase-HP.json'
    );
    test(
        'Eurolite LED KLS-801',
        'ecue',
        path.join('fixtures', 'eurolite_led_kls-801.json'),
        'Eurolite-LED-KLS-801.xml',
        'UserLibrary.xml'
    );
});


function test(name, format, inputFile, desiredOutputFile, outputFile) {
    cp.exec(
        'node ' + path.join(__dirname, '..', 'fixtures_convert.js')
        + ' -i ' + path.join(__dirname, inputFile)
        + ` -f ${format} -d ` + path.join(outputDir, '%FORMAT%'),
        (error, stdout, stderr) => {
            try {
                console.log(`Testing: Convert ${name} with format ${format} from ${inputFile} ...`);

                assert.strictEqual(error, null, error);
                assert.strictEqual(stderr, '', stderr);

                const stdoutLines = stdout.split('\n');
                const isImport = inputFile.endsWith('.json');
                assert.strictEqual(stdoutLines.length, 2+isImport, `${stdout}\nError: stdout has not ${2+isImport} lines`);
                if (isImport)
                    assert.strictEqual(stdoutLines[0], `Handling ${format} formatting...`, stdout + '\nError: missing "Handling ..." message');

                const outputtedFilePath = stdoutLines[0 + isImport].match(/File "([^"]*)" successfully written./);
                assert.notStrictEqual(outputtedFilePath, null, `${stdout}\nError: outputted file path not found`);
                assert.notStrictEqual(outputtedFilePath[1], undefined, `${stdout}\nError: outputted file path not found`);

                let outFilePath;
                const desiredOutFilePath = path.join(__dirname, 'desired_out', format, desiredOutputFile);
                if (outputFile !== undefined) {
                    outFilePath = path.join(outputDir, format, outputFile);
                    assert.strictEqual(outputtedFilePath[1], outFilePath, `Error: outputted file path ${outputtedFilePath[1]} doesn't match expected ${outFilePath}`); // '
                }
                else {
                    outFilePath = outputtedFilePath[1];
                }

                let out = fs.readFileSync(outFilePath, 'utf8');
                let desiredOut = fs.readFileSync(desiredOutFilePath, 'utf8');

                if (format == 'ecue') {
                    out = out.replace(/\d\d\d\d\-\d\d\-\d\d#\d\d:\d\d:\d\d/g, '');
                    desiredOut = desiredOut.replace(/\d\d\d\d\-\d\d\-\d\d#\d\d:\d\d:\d\d/g, '');
                }
                else if (format == 'qlcplus') {
                    out = out.replace(/<Author>[^<]*<\/Author>/g, '<Author></Author>');
                    desiredOut = desiredOut.replace(/<Author>[^<]*<\/Author>/g, '<Author></Author>');
                }

                assert.strictEqual(
                    out,
                    desiredOut,
                    "Out file doesn't equal desired out.\n"
                    + diff.createTwoFilesPatch(outFilePath, desiredOutFilePath, out, desiredOut)
                );

                console.log('Test ok.')
            }
            catch(assertionError) {
                console.error(assertionError.message);
                process.exit(1);
            }
        }
    );
}