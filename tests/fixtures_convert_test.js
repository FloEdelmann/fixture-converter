#!/usr/bin/node

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const diff = require('diff');

const assert = require('assert');


fs.mkdtemp(path.join(__dirname, 'out-'), (err, folder) => {
    if (err) throw err;

    test(
        'ADJ Quad Phase HP',
        'qlcplus',
        folder,
        'adj_quad_phase_hp.json',
        'American-DJ-Quad-Phase-HP.qxf'
    );
    test(
        'Eurolite LED KLS-801',
        'ecue',
        folder,
        'eurolite_led_kls-801.json',
        'UserLibrary.xml',
        'Eurolite-LED-KLS-801.xml'
    );
});


function test(name, format, outputDir, inputFile, desiredOutputFile, outputFile) {
    if (outputFile === undefined) {
        outputFile = desiredOutputFile;
    }

    cp.exec(
        'node ' + path.join(__dirname, '..', 'fixtures_convert.js')
        + ' -i ' + path.join(__dirname, 'fixtures', inputFile)
        + ` -f ${format} -d ` + path.join(outputDir, '%FORMAT%'),
        (error, stdout, stderr) => {
            console.log(`Testing: Convert ${name} with format ${format} ...`);

            if (error) {
                console.error(error);
                return;
            }
            if (stderr) {
               console.log(stderr);
            }

            const outFilePath = path.join(outputDir, format, desiredOutputFile);
            const desiredOutFilePath = path.join(__dirname, 'desired_out', format, outputFile);

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

            try {
                assert(out == desiredOut);
            }
            catch(assertionError) {
                console.error("Test failed: Out file doesn't equal desired out.");
                console.log(diff.createTwoFilesPatch(outFilePath, desiredOutFilePath, out, desiredOut));
                process.exit(1);
            }
            console.log('Test ok.')
        }
    );
}