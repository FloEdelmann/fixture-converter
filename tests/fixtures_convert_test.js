#!/usr/bin/node

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const diff = require('diff');
const assert = require('assert');

const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');

const formats = {
    "ecue": {
        fileEnding: ".xml",
        replacers: [
            [/\d\d\d\d\-\d\d\-\d\d#\d\d:\d\d:\d\d/g, '']
        ],
    },
    "qlcplus": {
        fileEnding: ".qxf",
        replacers: [
            [/<Author>[^<]*<\/Author>/g, '<Author></Author>']
        ],
    },
};
const defaultTest = {
    format: null,
    isImport: false,
    files: {
        'default': {
            hasWarnings: false
        }
    }
}

const useHarmonyFlag = require('semver').lt(process.version, '6.0.0');
console.log(`Using --harmony-destructuring flag? ${useHarmonyFlag}`);

const outputDir = path.join(__dirname, `out-${timestamp}`);
fs.mkdir(outputDir, (err) => {
    if (err) throw err;

    testDevice('American-DJ-Quad-Phase-HP', [
        {
            format: "ecue",
        },
        {
            format: "ecue",
            isImport: true,
        },
        {
            format: "qlcplus",
        },
        {
            format: "qlcplus",
            isImport: true,
        },
    ]);
    testDevice('Eurolite-LED-KLS-801', [
        {
            format: "ecue",
        },
        {
            format: "ecue",
            isImport: true,
            files: {
                'Eurolite-LED-KLS-801-control': { hasWarnings: true, },
                'Eurolite-LED-KLS-801-program': { hasWarnings: true, },
                'Eurolite-LED-KLS-801-combined': { hasWarnings: true, },
                'Eurolite-LED-KLS-801-color': { hasWarnings: true, },
            }
        },
        {
            format: "qlcplus",
        },
        {
            format: "qlcplus",
            isImport: true,
        },
    ]);
    testDevice('Eurolite-LED-TMH-18', [ // especially for 16-bit channel testing
        {
            format: "ecue",
        }
    ]);
});


function testDevice(deviceName, tests) {
    for (const testData of tests) {
        test(deviceName, testData);
    }
}


function test(deviceName, testData) {
    const format = formats[testData.format];
    const useDefaultFile = testData.files === undefined;
    testData = Object.assign({}, defaultTest, testData);

    const inputFileEnding = (testData.isImport ? format.fileEnding : '.json');
    const outputFileEnding = (testData.isImport ? '.json' : format.fileEnding);

    const inputFile = testData.isImport ?
        path.join(
            'desired_out',
            testData.format,
            deviceName + inputFileEnding
        ) :
        path.join(
            'fixtures',
            deviceName + inputFileEnding
        );

    const command = 'node ' + (useHarmonyFlag ? '--harmony-destructuring ' : '')
        + path.join(__dirname, '..', 'fixtures_convert.js')
        + ' -i ' + path.join(__dirname, inputFile)
        + ` -f ${testData.format}`
        + ' -o ' + path.join(outputDir, '%FORMAT%', `%MANUFACTURER%-%FIXTURE%${outputFileEnding}`);
    cp.exec(
        command,
        (error, stdout, stderr) => {
            try {
                console.log(`Testing command: ${command} ...`);

                assert.strictEqual(error, null, `${stdout}\n${stderr}\n${error}`);
                assert.strictEqual(stderr, '', `${stdout}\n${stderr}`);

                const stdoutLines = stdout.split('\n');
                // remove "Handling ..." message in the first line when exporting
                if (!testData.isImport) {
                    assert.strictEqual(stdoutLines.shift(), `Handling ${testData.format} formatting...`, stdout + '\nError: missing "Handling ..." message');
                }
                // remove last (empty) line
                assert.strictEqual(stdoutLines.pop(), '', stdout + '\nError: last line not empty');

                let fileCount = 0;
                for (let i = 0; i < stdoutLines.length; i++) {
                    const line = stdoutLines[i];
                    const returnedFile = line.match(/File "([^"]*)" successfully written./);
                    let basename = path.basename(returnedFile[1], outputFileEnding);
                    const errorMessage = `${stdout}\nError: outputted file path not found (file ${fileCount+1} in line ${i+1})`;
                    assert.notStrictEqual(returnedFile, null, errorMessage);
                    assert.notStrictEqual(returnedFile[1], undefined, errorMessage);

                    // check if the returned file name was desired
                    let desiredFile;
                    if (useDefaultFile) {
                        desiredFile = defaultTest.files.default;
                    } else {
                        desiredFile = testData.files[basename];
                        assert.notStrictEqual(
                            desiredFile,
                            undefined,
                            stdout + `\nError: unexpected file ${basename}`
                        )
                        desiredFile = Object.assign({}, defaultTest.files.default, desiredFile);
                        delete testData.files[basename];
                    }

                    // check equality of returned and desired file contents
                    let returnedFileContent = fs.readFileSync(
                        returnedFile[1],
                        'utf8'
                    );
                    const desiredContentFilePath = path.join(__dirname, 'desired_out', testData.format, basename + outputFileEnding);
                    let desiredContent = fs.readFileSync(
                        desiredContentFilePath,
                        'utf8'
                    );

                    if (format.replacers !== undefined && format.replacers !== null) {
                        for (const replacer of format.replacers) {
                            returnedFileContent = returnedFileContent.replace(replacer[0], replacer[1]);
                            desiredContent = desiredContent.replace(replacer[0], replacer[1]);
                        }
                    }

                    assert.strictEqual(
                        returnedFileContent,
                        desiredContent,
                        "Returned file content doesn't equal desired content.\n"
                        + "--- returned output file\n"
                        + "+++ desired output file\n"
                        + diff.createTwoFilesPatch(returnedFile[1], desiredContentFilePath, returnedFileContent, desiredContent)
                    );

                    // check if next line is a warning and if there should be a warning
                    const nextLine = stdoutLines[i+1];
                    if (desiredFile.hasWarnings) {
                        assert.strictEqual(
                            nextLine,
                            "Please check for warnings using a text editor.",
                            stdout + `\nError: warning expected in line ${i+2}`
                        );
                        // skip next line in this loop
                        i++;
                    }
                    else {
                        assert.notStrictEqual(
                            nextLine,
                            "Please check for warnings using a text editor.",
                            stdout + `\nError: unexpected warning in line ${i+2}`
                        );
                    }

                    fileCount++;
                }

                console.log('Test ok.')
            }
            catch(assertionError) {
                console.error(assertionError.message);
                process.exit(1);
            }
        }
    );
}