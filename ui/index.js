'use strict';

const ipc = require('electron').ipcRenderer;

let formats = [];
let inputFiles = [];

let homeDir = "";

const $select = document.querySelector('#format');
const $inputFiles = document.querySelector('#inputFiles');
const $inputAddFileButton = $inputFiles.querySelector('.addFile');
const $inputAddDirButton = $inputFiles.querySelector('.addDir');
const $importRadio = document.querySelector('#import');
const $exportRadio = document.querySelector('#export');
const $output = document.querySelector('#output');
const $outputBtn = document.querySelector('#outputBtn');
const $convertBtn = document.querySelector('#convertBtn');

$inputAddFileButton.addEventListener('click', event => {
    openInputDialog(false);
});
$inputAddDirButton.addEventListener('click', event => {
    openInputDialog(true);
});
$outputBtn.addEventListener('click', openOutputDialog);
$select.addEventListener('change', updateOutput);
$importRadio.addEventListener('click', updateOutput);
$exportRadio.addEventListener('click', updateOutput);
$convertBtn.addEventListener('click', doConversion);

ipc.on('formats', (ipcEvent, myFormats) => {
    formats = myFormats;

    $select.innerHTML = '<option value="" default>Select format</option>';

    for (let format of formats) {
        $select.innerHTML += `<option value="${format.key}">${format.name}</option>`;
    }
});

ipc.on('inputFiles', (ipcEvent, newInputFiles) => {
    if (newInputFiles == null)
        return;

    inputFiles = inputFiles.concat(newInputFiles);

    for (let file of newInputFiles) {
        let $file = document.createElement('div');
        $file.className = "file";
        $file.innerHTML = file;

        let $button = document.createElement('button');
        $button.className = "close";
        $button.innerHTML = "X";
        $button.addEventListener('click', event => {
            let $file = event.target.parentNode;
            let index = Array.prototype.indexOf.call($inputFiles.children, $file);
            index -= $inputFiles.children.length - inputFiles.length;

            inputFiles.splice(index, 1);
            $inputFiles.removeChild($file);
        });

        $file.appendChild($button);
        $inputFiles.appendChild($file);
    }
});

ipc.on('outputDirectory', (ipcEvent, outputDirectories) => {
    if (outputDirectories == null)
        return;

    homeDir = outputDirectories[0];
    updateOutput();
});

ipc.on('env', (ipcEvent, os, newHomeDir) => {
    homeDir = newHomeDir;

    const $body = document.querySelector('body');
    switch (os) {
        case 'linux':
            $body.fontFamily = 'Ubuntu,Oxygen-Sans,Roboto,sans-serif';
            break;
        case 'darwin':
            $body.fontFamily = '-apple-system,BlinkMacSystemFont,Cantarell,"Helvetica Neue",sans-serif';
            break;
        case 'win32':
            $body.fontFamily = '"Segoe UI",sans-serif';
            break;
    }
    updateOutput();
});

ipc.on('conversionResults', (ipcEvent, error, stdout, stderr) => {
    console.log(error, stdout, stderr);
});




ipc.send('requestFormats');
ipc.send('requestEnv');


function openInputDialog(directories = false) {
    let format;

    for (let i=0; i<formats.length; i++) {
        if (formats[i].key == $select.value) {
            format = formats[i];
            break;
        }
    }

    let options = {
        "title": "Select input files",
        "properties": ["multiSelections"]
    };

    options.properties.push(directories ? "openDirectory" : "openFile");

    if (!$importRadio.checked) {
        options.filters = [{
            "name": "JSON files",
            "extensions": ['json']
        }];
    }
    else if (format) {
        options.filters = [{
            "name": format.name + (directories ? ' directories' : ' files'),
            "extensions": [format.ext]
        }];
    }

    ipc.send('openInputDialog', options);
}

function openOutputDialog() {
    let options = {
        "title": "Select output directory",
        "properties": ["openDirectory"]
    };
    ipc.send('openOutputDialog', options);
}

function updateOutput() {
    if ($importRadio.checked) {
        $output.value = homeDir + "/fixture-converter/import.json";
    }
    else if ($select.value !== "") {
        let format;
        for (let i=0; i<formats.length; i++) {
            if (formats[i].key == $select.value) {
                format = formats[i];
                break;
            }
        }
        $output.value = homeDir + "/fixture-converter/" + format.defaultFileName;
    }
}

function doConversion() {
    if ($select.value == "") {
        alert("Please specify a format!");
    }
    else if ($output.value == "") {
        alert("Please specify the output path!");
    }
    else if (inputFiles.length == 0) {
        alert("Please specify one or more input files!");
    }
    else {
        ipc.send('doConversion', `-f ${$select.value} -o "${$output.value}"` + inputFiles.map(file => ` -i "${file}"`));
    }
}