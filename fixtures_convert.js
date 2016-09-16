#!/usr/bin/node

/* TODO:
* what is ecue's deflection?
* what is ecue's header?
* what is ecue's (classicPos) / classicEntry?
*/

'use strict';

let filename = 'fixtures.json';
/************** File format & defaults: **************/
const defaults = {
    "manufacturers": {
        "shortName": {
            "name": null, // required
            "comment": "", // optional
            "website": "" // optional
        }
    },
    "fixtures": [
        {
            "manufacturer": null, // required. One of the shortNames from above
            "name": null, // required
            "shortName": null, // optional but recommended. Default: name. Keep as short as possible!
            "type": "Other", // optional. Possible values: "Color Changer/Dimmer/Effect/Fan/Flower/Hazer/Laser/Moving Head/Other/Scanner/Smoke/Strobe"
            "comment": "", // optional
            "physical": {  // optional
                "bulb": {
                    "colorTemperature": 0, // optional
                    "type": "", // optional. e.g. "LED"
                    "lumens": 0 // optional
                },
                "dimensions": [0, 0, 0], // optional. width, height, depth (in mm)
                "weight": 0.0, // optional. in kg.
                "lens": {
                    "name": "Other", // optional. Possible values: "PC/Fresnel/Other/free text"
                    "degreesMinMax": [0.0, 0.0] // optional. Range 0..360 (in deg)
                },
                "focus": {
                    "type": "Fixed", // optional. Possible values: "Fixed/Head/Mirror/Barrel/free text"
                    "panMax": 0, // optional. in deg.
                    "tiltMax": 0 // optional. in deg.
                },
                "DMXconnector": "3-pin", // optional. Possible values: "3-pin/5-pin/3-pin and 5-pin/3.5mm stereo jack/Other/free text"
                "power": 0 // optional. in W.
            },
            "availableChannels": {
                "ch1": {
                    "name": null, // required
                    "byte": 0, // only for 16bit channels. 0 for MSB / 1 for LSB
                    "type": "Intensity", // optional. Possible values: "Intensity/Shutter/Speed/Color/Gobo/Prism/Pan/Tilt/Beam/Effect/Maintenance/Nothing". Note: Use "Color" only for multiple colors in one channel, and "Intensity" else.
                    "color": "Generic", // optional. Possible values: "Generic/Red/Green/Blue/Cyan/Magenta/Yellow/Amber/White/UV/Lime". Note: Only important if "type" is "Intensity"
                    "defaultValue": 0, // optional. DMX channel value
                    "highlightValue": 0, // optional. DMX channel value
                    "invert": false, // optional
                    "constant": false, // optional
                    "crossfade": false, // optional
                    "precendence": "LTP", // optional. Possible values: "HTP/LTP"
                    "capabilities": [ // required
                        {
                            "range": [0, 255],
                            "name": "0-100%",
                            "showInMenu": true, // optional
                            "center": false, // optional
                            // only for channel types "Color", "Effect" and "Gobo":
                            "color": null, // optional. String with color hex code. Not used when "image" is set.
                            "color2": null, // optional. String with color hex code. Not used when "image" is set.
                            "image": null, // optional. String with path to image
                        }
                    ]
                }
            },
            "modes": [ // required
                {
                    "name": null, // required. e.g. "7-channel Mode",
                    "shortName": null, // optional. Default: name. e.g. "7ch"
                    "physical": {}, // optional. overrides fixture defaults.
                    "channels": null, // required. Use channels defined in availableChannels. To mark 16bit channels, wrap them in another array, e.g. ["ch1", ["ch2", "ch3"], "ch4", "ch5", "ch6", "ch7"]
                    "heads": {} // optional. Group channels used for each head. e.g. { "Head 1":["ch4","ch5"], "Head 2":["ch6","ch7"] }
                }
            ]
        }
    ]
};
/**************/

const formats = ['ecue', 'qlcplus'];

const fs = require('fs');
const path = require('path');

const {argv, options} = require('node-getopt').create([
    ['o' , 'format=ARG', `Required. Specifies output format. Possible arguments: "${formats.join('", "')}"`],
    ['f' , 'filename=ARG', `Specifies input filename. Default: "${filename}"`],
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

    fs.mkdir(options.format, (mkdirError) => {
        if (mkdirError && mkdirError.code != 'EEXIST') {
            die(`Error creating directory "${options.format}", exiting.`, mkdirError);
        }

        if (options.format == 'ecue') {
            formatEcue();
        }
        else if (options.format == 'qlcplus') {
            formatQLCplus();
        }
    })
});


function formatEcue() {
    const timestamp = new Date().toISOString().replace(/T/, '#').replace(/\..+/, '');
    let str = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    str += `<Document Owner="user" TypeVersion="2" SaveTimeStamp="${timestamp}">\n`;
    str += '    <Library>\n'
    str += '        <Fixtures>\n';

    for (const manufacturer in manufacturers) {
        const manData = extend({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}">\n`;

        for (const fixture of fixtures) {
            if (fixture.manufacturer != manufacturer) continue;

            let fixData = extend({}, defaults.fixtures[0], fixture);
            if (fixData.shortName == null)
                fixData.shortName = fixData.name;

            for (const mode of fixture.modes) {
                let modeData = extend({}, defaults.fixtures[0].modes[0], mode);
                if (modeData.shortName == null)
                    modeData.shortName = modeData.name;

                const useName = fixData.name + (fixture.modes.length == 1 ? '' : ` (${modeData.shortName})`);
                const useComment = fixData.comment + (fixture.modes.length == 1 ? '' : ` (${modeData.name})`);

                const physicalData = extend({}, defaults.fixtures[0].modes[0].physical, fixData.physical, modeData.physical);
                const bulbData = extend({}, defaults.fixtures[0].modes[0].physical.bulb, physicalData.bulb);
                const lensData = extend({}, defaults.fixtures[0].modes[0].physical.lens, physicalData.lens);
                const focusData = extend({}, defaults.fixtures[0].modes[0].physical.focus, physicalData.focus);

                let fixStr = '';

                let i = 1;
                for (const ch in mode.channels) {
                    const doubleByte = Array.isArray(mode.channels[ch]);
                    const chan = (doubleByte ? mode.channels[ch][0] : mode.channels[ch]);
                    const channel = fixture.availableChannels[chan];

                    if (channel === undefined) {
                        die(`Channel "${mode.channels[ch]}" not found in fixture "${fixData.name}", exiting.`);
                    }

                    let chData = extend({}, defaults.fixtures[0].availableChannels.ch1, channel);

                    let chType = '';
                    let chName = chData.name;
                    switch (chData.type) {
                        case 'Color':
                            chType = 'Color';
                            break;
                        case 'Beam':
                        case 'Shutter':
                        case 'Gobo':
                        case 'Prism':
                        case 'Effect':
                        case 'Speed':
                        case 'Maintenance':
                        case 'Nothing':
                            chType = 'Beam';
                            break;
                        case 'Pan':
                        case 'Tilt':
                            chType = 'Focus';
                            break;
                        case 'Intensity':
                        default:
                            chType = 'Intensity';
                    }

                    if (channel.type == 'Intensity' && channel.color) {
                        chType = 'Color';
                        chName = chData.color;
                    }

                    if (doubleByte) {
                        let msb = chData;
                        let lsb = extend({}, defaults.fixtures[0].availableChannels.ch1, fixture.availableChannels[mode.channels[1]]);

                        if (msb.byte == 1) {
                            // swap msb and lsb
                            [msb, lsb] = [lsb, msb];
                        }

                        chData.defaultValue = (msb.defaultValue * 256) + lsb.defaultValue;
                        chData.highlightValue = (msb.highlightValue * 256) + lsb.highlightValue;
                    }

                    let hasCapabilities = (channel.capabilities !== undefined);

                    fixStr += `                    <Channel${chType} Name="${chName}" DefaultValue="${chData.defaultValue}" Highlight="${chData.highlightValue}" Deflection="0" DmxByte0="${i}"` + (doubleByte ? ` DmxByte1="${++i}"` : '') + ` Constant="${chData.constant ? 1 : 0}" Crossfade="${chData.crossfade ? 1 : 0}" Invert="${chData.invert ? 1 : 0}" Precedence="${chData.precendence}" ClassicPos="${ch}"` + (hasCapabilities ? '' : ' /') + '>\n';

                    if (hasCapabilities) {
                        for (const cap of channel.capabilities) {
                            const capData = extend({}, defaults.fixtures[0].availableChannels.ch1.capabilities[0], cap);

                            fixStr += `                        <Range Name="${capData.name}" Start="${capData.range[0]}" End="${capData.range[1]}" AutoMenu="${capData.showInMenu ? 1 : 0}" Centre="${capData.center ? 1 : 0}" />\n`;
                        }
                        fixStr += `                    </Channel${chType}>\n`;
                    }

                    i++;
                }

                str += `                <Fixture _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${useName}" NameShort="${fixData.shortName}" Comment="${useComment}" AllocateDmxChannels="${i-1}" Weight="${physicalData.weight}" Power="${physicalData.power}" DimWidth="${physicalData.dimensions[0]}" DimHeight="${physicalData.dimensions[1]}" DimDepth="${physicalData.dimensions[2]}">\n`;
                str += fixStr;
                str += '                </Fixture>\n';
            }
        }
        str += '            </Manufacturer>\n';
    }
    str += '        </Fixtures>\n';
    str += '        <Tiles>\n';

    for (const manufacturer in manufacturers) {
        const manData = extend({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`;
    }
    str += '        </Tiles>\n';
    str += '    </Library>\n';
    str += '</Document>\n';

    let outFile = [options.format, 'UserLibrary.xml'].join(path.sep);

    fs.writeFile(outFile, str, (writeError) => {
        if (writeError) {
            die(`Error writing to file "${outFile}", exiting.`, writeError);
        }
        console.log(`File "${outFile} successfully written.`);
    });
}
function formatQLCplus() {
    console.log("handling qlcplus");
}


function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}


// from http://stackoverflow.com/a/11197343
function extend(target, ...sources) {
    for (let obj of sources) {
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                target[key] = obj[key];
            }
        }
    }
    return target;
}