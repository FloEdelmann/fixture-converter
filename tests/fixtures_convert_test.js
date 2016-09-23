#!/usr/bin/node

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const diff = require('diff');
const assert = require('assert');

const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');

const useHarmonyFlag = require('semver').lt(process.version, '6.0.0');
console.log(`Using --harmony-destructuring flag? ${useHarmonyFlag}`);

const outputDir = path.join(__dirname, `out-${timestamp}`);
fs.mkdir(outputDir, (err) => {
    if (err) throw err;

    test(
        'ADJ Quad Phase HP',
        'qlcplus',
        path.join('fixtures', 'adj_quad_phase_hp.json'),
        'American-DJ-Quad-Phase-HP.qxf',
        '%MANUFACTURER%-%FIXTURE%-qlcplus-export.qxf',
        'American-DJ-Quad-Phase-HP-qlcplus-export.qxf'
    );
    test(
        'ADJ Quad Phase HP',
        'qlcplus',
        path.join('desired_out', 'qlcplus', 'American-DJ-Quad-Phase-HP.qxf'),
        'American-DJ-Quad-Phase-HP.json',
        '%MANUFACTURER%-%FIXTURE%-qlcplus-import.json',
        'American-DJ-Quad-Phase-HP-qlcplus-import.json'
    );
    test(
        'Eurolite LED KLS-801',
        'ecue',
        path.join('fixtures', 'eurolite_led_kls-801.json'),
        'Eurolite-LED-KLS-801.xml',
        '%MANUFACTURER%-%FIXTURE%-ecue-export.xml',
        'Eurolite-LED-KLS-801-ecue-export.xml'
    );
});


function test(name, format, inputFile, desiredOutputFile, requestedOutputFile, expectedOutputFile) {
    cp.exec(
        'node ' + (useHarmonyFlag ? '--harmony-destructuring ' : '')
        + path.join(__dirname, '..', 'fixtures_convert.js')
        + ' -i ' + path.join(__dirname, inputFile)
        + ` -f ${format}`
        + ' -o ' + path.join(outputDir, '%FORMAT%', requestedOutputFile),
        (error, stdout, stderr) => {
            try {
                console.log(`Testing: Convert ${name} with format ${format} from ${inputFile} ...`);

                assert.strictEqual(error, null, `${stdout}\n${stderr}\n${error}`);
                assert.strictEqual(stderr, '', `${stdout}\n${stderr}`);

                const stdoutLines = stdout.split('\n');
                const isImport = inputFile.endsWith('.json');
                assert.strictEqual(stdoutLines.length, 2+isImport, `${stdout}\nError: stdout has not ${2+isImport} lines`);
                if (isImport)
                    assert.strictEqual(stdoutLines[0], `Handling ${format} formatting...`, stdout + '\nError: missing "Handling ..." message');

                const returnedFilePath = stdoutLines[0 + isImport].match(/File "([^"]*)" successfully written./);
                assert.notStrictEqual(returnedFilePath, null, `${stdout}\nError: outputted file path not found`);
                assert.notStrictEqual(returnedFilePath[1], undefined, `${stdout}\nError: outputted file path not found`);

                const expectedOutFilePath = path.join(outputDir, format, expectedOutputFile);
                assert.strictEqual(
                    returnedFilePath[1],
                    expectedOutFilePath,
                    `Error: returned file path ${returnedFilePath[1]} doesn't match expected ${expectedOutFilePath}` // '
                );
                const desiredOutFilePath = path.join(__dirname, 'desired_out', format, desiredOutputFile);

                let out = fs.readFileSync(expectedOutFilePath, 'utf8');
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
                    + diff.createTwoFilesPatch(expectedOutFilePath, desiredOutFilePath, out, desiredOut)
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