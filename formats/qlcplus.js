'use strict';

const fs = require('fs');
const path = require('path');

const defaults = require(['..', 'fixtures_defaults.js'].join(path.sep));

module.exports.export = function formatQLCplus(manufacturers, fixtures, localOutDir) {
    for (const fixture of fixtures) {
        let str = '<?xml version="1.0" encoding="UTF-8"?>\n';
        str += '<!DOCTYPE FixtureDefinition>\n';
        str += '<FixtureDefinition xmlns="http://www.qlcplus.org/FixtureDefinition">\n';
        str += ' <Creator>\n';
        str += '  <Name>DMX Fixture converter</Name>\n';
        str += '  <Version>1.0</Version>\n';
        let username = process.env['LOGNAME'];
        username = username == undefined ? process.env['%USERNAME%'] : username;
        username = username == undefined ? 'https://github.com/FloEdelmann/fixture-converter' : username;
        str += `  <Author>${username}</Author>\n`;
        str += ' </Creator>\n';

        let fixData = Object.assign({}, defaults.fixtures[0], fixture);
        if (fixData.shortName == null) {
            fixData.shortName = fixData.name;
        }

        const manData = Object.assign({}, defaults.manufacturers.shortName, manufacturers[fixData.manufacturer]);
        if (manData.name == null) {
            manData.name = fixData.manufacturer;
        }

        str += ` <Manufacturer>${manData.name}</Manufacturer>\n`;
        str += ` <Model>${fixData.name}</Model>\n`;
        str += ` <Type>${fixData.type}</Type>\n`;

        const chDatas = {};
        for (const channel in fixData.availableChannels) {
            const chData = chDatas[channel] = Object.assign({}, defaults.fixtures[0].availableChannels.ch1, fixData.availableChannels[channel]);

            if (!chData.name)
                chData.name = channel;

            let byte = 0;
            for (const multiByteChannel of fixData.multiByteChannels) {
                for (const i in multiByteChannel) {
                    if (multiByteChannel[i] == channel) {
                        byte = i;
                        break;
                    }
                }
            }

            str += ` <Channel Name="${chData.name}">\n`;
            str += `  <Group Byte="${byte}">${chData.type}</Group>\n`;

            for (const capability of chData.capabilities) {
                const capData = Object.assign({}, defaults.fixtures[0].availableChannels.ch1.capabilities[0], capability);

                str += `  <Capability Min="${capData.range[0]}" Max="${capData.range[1]}"`;
                if (capData.image != null) {
                    str += ` res="${capData.image}"`;
                }
                else {
                    if (capData.color != null) {
                        str += ` Color="${capData.color}"`;
                    }
                    if (capData.color2 != null) {
                        str += ` Color2="${capData.color2}"`;
                    }
                }
                str += `>${capData.name}</Capability>\n`;
            }

            str += ' </Channel>\n';
        }

        let physData = Object.assign({}, defaults.fixtures[0].physical, fixData.physical);
        physData.bulb = Object.assign({}, defaults.fixtures[0].physical.bulb, fixData.physical.bulb);
        physData.lens = Object.assign({}, defaults.fixtures[0].physical.lens, fixData.physical.lens);
        physData.focus = Object.assign({}, defaults.fixtures[0].physical.focus, fixData.physical.focus);

        for (const mode of fixData.modes) {
            let modeData = Object.assign({}, defaults.fixtures[0].modes[0], mode);
            modeData.physical = Object.assign({}, physData, modeData.physical);
            modeData.physical.bulb = Object.assign({}, physData.bulb, modeData.physical.bulb);
            modeData.physical.lens = Object.assign({}, physData.lens, modeData.physical.lens);
            modeData.physical.focus = Object.assign({}, physData.focus, modeData.physical.focus);

            str += ` <Mode Name="${modeData.name}">\n`;

            str += `  <Physical>\n`;
            str += `   <Bulb ColourTemperature="${modeData.physical.bulb.colorTemperature}" Type="${modeData.physical.bulb.type}" Lumens="${modeData.physical.bulb.lumens}" />\n`;
            str += `   <Dimensions Width="${modeData.physical.dimensions[0]}" Height="${modeData.physical.dimensions[1]}" Depth="${modeData.physical.dimensions[2]}" Weight="${modeData.physical.weight}" />\n`;
            str += `   <Lens Name="${modeData.physical.lens.name}" DegreesMin="${modeData.physical.lens.degreesMinMax[0]}" DegreesMax="${modeData.physical.lens.degreesMinMax[1]}" />\n`;
            str += `   <Focus Type="${modeData.physical.focus.type}" TiltMax="${modeData.physical.focus.tiltMax}" PanMax="${modeData.physical.focus.panMax}" />\n`;
            str += `   <Technical DmxConnector="${modeData.physical.DMXconnector}" PowerConsumption="${modeData.physical.power}" />\n`;
            str += `  </Physical>\n`;

            for (let i = 0; i < modeData.channels.length; i++) {
                let channel = modeData.channels[i];
                str += `  <Channel Number="${i}">${chDatas[channel].name}</Channel>\n`;
            }

            for (const head in fixData.heads) {
                const headLampList = fixData.heads[head];
                let headChannelList = [];
                for (const channel of headLampList) {
                    const chNum = modeData.channels.indexOf(channel);
                    if (chNum != -1) {
                        headChannelList.push(chNum);
                    }
                }

                if (headChannelList.length > 0) {
                    str += '  <Head>\n';
                    for (const chNum of headChannelList) {
                        str += `   <Channel>${chNum}</Channel>\n`;
                    }
                    str += '  </Head>\n';
                }
            }

            str += ` </Mode>\n`;
        }

        str += '</FixtureDefinition>';

        const outFile = [
            localOutDir,
            (manData.name + "-" + fixData.name).replace(/\s+/g, '-') + '.qxf'
        ].join(path.sep);

        fs.writeFile(outFile, str, (writeError) => {
            if (writeError) {
                die(`Error writing to file "${outFile}", exiting.`, writeError);
            }
            console.log(`File "${outFile}" successfully written.`);
        });
    }
}

module.exports.import = function importQLCplus(str, filename) {
    const xml2js = require('xml2js');

    const parser = new xml2js.Parser();

    return new Promise((resolve, reject) => {
        parser.parseString(str, function(parseError, xml) {
            if (parseError) {
                die(`Error parsing "${filename}", exiting.`, parseError);
            }

            let out = {
                "manufacturers": {},
                "fixtures": []
            };
            let fix = {};

            try {
                const fixture = xml.FixtureDefinition
                fix.manufacturer = fixture.Manufacturer[0];
                fix.name = fixture.Model[0];
                fix.type = fixture.Type[0];
                fix.physical = {};
                fix.availableChannels = {};

                let doubleByteChannels = [];

                for (const channel of fixture.Channel) {
                    let ch = {
                        "name": channel.$.Name,
                        "type": channel.Group[0]._,
                        "capabilities": []
                    };

                    if (channel.Group[0].$.Byte == "1") {
                        doubleByteChannels.push([channel.$.Name]);
                    }

                    for (const capability of channel.Capability) {
                        let cap = {
                            "range": [parseInt(capability.$.Min), parseInt(capability.$.Max)],
                            "name": capability._
                        };

                        if (capability.$.Color)
                            cap.color = capability.$.Color;

                        if (capability.$.Color2)
                            cap.color2 = capability.$.Color2;

                        if (capability.$.res)
                            cap.image = capability.$.res;

                        ch.capabilities.push(cap);
                    }

                    if (ch.capabilities.length == 0)
                        delete ch.capabilities;

                    fix.availableChannels[channel.$.Name] = ch;
                }

                if (doubleByteChannels.length > 0) {
                    fix.multiByteChannels = doubleByteChannels;
                    fix.warning = "Please validate these 16-bit channels!";
                }

                fix.heads = {};
                fix.modes = [];

                for (const mode of fixture.Mode) {
                    let mod = {
                        "name": mode.$.Name
                    };

                    let physical = {};

                    if (mode.Physical[0].Dimensions[0].$.Width != "0"
                        || mode.Physical[0].Dimensions[0].$.Height != "0"
                        || mode.Physical[0].Dimensions[0].$.Depth != "0") {
                        physical.dimensions = [
                            parseInt(mode.Physical[0].Dimensions[0].$.Width),
                            parseInt(mode.Physical[0].Dimensions[0].$.Height),
                            parseInt(mode.Physical[0].Dimensions[0].$.Depth)
                        ];
                    }

                    if (parseFloat(mode.Physical[0].Dimensions[0].$.Weight) !== 0.0)
                        physical.weight = parseFloat(mode.Physical[0].Dimensions[0].$.Weight);

                    if (mode.Physical[0].Technical[0].$.PowerConsumption != "0")
                        physical.power = parseInt(mode.Physical[0].Technical[0].$.PowerConsumption);

                    if (mode.Physical[0].Technical[0].$.DmxConnector != "")
                        physical.DMXconnector = mode.Physical[0].Technical[0].$.DmxConnector;

                    let bulbData = {};
                    if (mode.Physical[0].Bulb[0].$.Type != "")
                        bulbData.type = mode.Physical[0].Bulb[0].$.Type;
                    if (mode.Physical[0].Bulb[0].$.ColourTemperature != "0")
                        bulbData.colorTemperature = parseInt(mode.Physical[0].Bulb[0].$.ColourTemperature);
                    if (mode.Physical[0].Bulb[0].$.Lumens != "0")
                        bulbData.lumens = parseInt(mode.Physical[0].Bulb[0].$.Lumens);
                    if (JSON.stringify(bulbData) != '{}')
                        physical.bulb = bulbData;

                    let lensData = {};
                    if (mode.Physical[0].Lens[0].$.Name != "")
                        lensData.name = mode.Physical[0].Lens[0].$.Name;
                    if (parseFloat(mode.Physical[0].Lens[0].$.DegreesMin) !== 0.0 || parseFloat(mode.Physical[0].Lens[0].$.DegreesMax) !== 0.0)
                        lensData.degreesMinMax = [parseFloat(mode.Physical[0].Lens[0].$.DegreesMin), parseFloat(mode.Physical[0].Lens[0].$.DegreesMax)];
                    if (JSON.stringify(lensData) != '{}')
                        physical.lens = lensData;

                    let focusData = {};
                    if (mode.Physical[0].Focus[0].$.Type != "")
                        focusData.type = mode.Physical[0].Focus[0].$.Type;
                    if (mode.Physical[0].Focus[0].$.PanMax != "0")
                        focusData.panMax = parseInt(mode.Physical[0].Focus[0].$.PanMax);
                    if (mode.Physical[0].Focus[0].$.TiltMax != "0")
                        focusData.tiltMax = parseInt(mode.Physical[0].Focus[0].$.TiltMax);
                    if (JSON.stringify(focusData) != '{}')
                        physical.focus = focusData;

                    if (JSON.stringify(physical) != '{}')
                        mod.physical = physical;

                    mod.channels = [];
                    for (const ch of mode.Channel) {
                        mod.channels[parseInt(ch.$.Number)] = ch._;
                    }

                    for (let i in mode.Head) {
                        let head = [];

                        for (const ch of mode.Head[i].Channel) {
                            const chNum = parseInt(ch);
                            head.push(mod.channels[chNum]);
                        }

                        fix.heads[mod.name + '-head' + i] = head;
                    }

                    fix.modes.push(mod);
                }

                if (JSON.stringify(fix.heads) == '{}')
                    delete fix.heads;

                out.fixtures.push(fix);
            }
            catch (parseError) {
                die(`Error parsing "${filename}", exiting.`, parseError);
            }

            resolve(out);
        });
    });
}

function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}