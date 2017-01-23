'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const defaults = require(path.join(__dirname, '..', 'fixtures_defaults.js'));

module.exports.formatName = 'QLC+';
module.exports.defaultFileExt = 'qxf';
module.exports.defaultFileName = '%MANUFACTURER%-%FIXTURE%.qxf';

module.exports.export = function formatQLCplus(manufacturers, fixtures, optionOutput) {
    const allowedChannelTypes = ["Intensity", "Shutter", "Speed", "Gobo", "Prism", "Pan", "Tilt", "Beam", "Effect", "Maintenance", "Nothing"];

    if (!optionOutput.includes('%FIXTURE%'))
        die('qlcplus only allows one fixture per .qxf file, so please include "%FIXTURE%" in the output filename.');


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

        let manData = Object.assign({}, defaults.manufacturers.shortName, manufacturers[fixData.manufacturer]);
        if (manData.name == null)
            manData.name = fixData.manufacturer;

        str += ` <Manufacturer>${manData.name}</Manufacturer>\n`;
        str += ` <Model>${fixData.name}</Model>\n`;
        str += ` <Type>${fixData.type}</Type>\n`;

        const chDatas = {};
        for (const channel in fixData.availableChannels) {
            const chData = chDatas[channel] = Object.assign({}, defaults.fixtures[0].availableChannels["Unique channel name"], fixData.availableChannels[channel]);

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

            
            if (chData.type == 'SingleColor') {
                chData.type = 'Intensity';
            }
            else if (chData.type == 'MultiColor') {
                chData.type = 'Colour';
            }
            else if (chData.type == 'Strobe') {
                chData.type = 'Shutter';
            }
            else if (allowedChannelTypes.indexOf(chData.type) == -1) {
                console.warn(`Channel type "${chData.type}" not supported, falling back to "Intensity" (in "${fixData.name}", channel "${chData.name}").`);
                chData.type = 'Intensity';
            }
            
            str += `  <Group Byte="${byte}">${chData.type}</Group>\n`;
            if (chData.type == 'Intensity') {
                str += `  <Colour>${chData.color}</Colour>\n`;
            }


            for (const capability of chData.capabilities) {
                const capData = Object.assign({}, defaults.fixtures[0].availableChannels["Unique channel name"].capabilities[0], capability);

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

                if (!chDatas[channel])
                    die(`Channel "${channel}" not found in fixture "${fixData.name}" (mode "${modeData.name}"), exiting.`);
                
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

        const outFile = optionOutput
            .replace(/%MANUFACTURER%/g, manData.name.replace(/[^a-z0-9_]+/gi, '-'))
            .replace(/%FIXTURE%/g, fixData.name.replace(/[^a-z0-9_]+/gi, '-'));

        mkdirp(path.dirname(outFile), (mkdirpError) => {
            if (mkdirpError)
                die(`Could not create directory "${path.dirname(outFile)}", exiting.`, mkdirpError);
            
            fs.writeFile(outFile, str, (writeError) => {
                if (writeError)
                    die(`Error writing to file "${outFile}", exiting.`, writeError);

                console.log(`File "${outFile}" successfully written.`);
            });
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

                for (const channel of fixture.Channel || []) {
                    let ch = {
                        "type": channel.Group[0]._
                    };

                    if (ch.type == "Intensity") {
                        ch.crossfade = true;
                    }

                    if (ch.type == "Colour") {
                        ch.type = "MultiColor";
                    }
                    else if (channel.Colour) {
                        ch.type = "SingleColor";
                        ch.color = channel.Colour[0];
                    }
                    else if (channel.$.Name.toLowerCase().includes("strob")) {
                        ch.type = "Strobe";
                    }

                    if (channel.Group[0].$.Byte == "1")
                        doubleByteChannels.push([channel.$.Name]);

                    ch.capabilities = [];
                    for (const capability of channel.Capability || []) {
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

                for (const mode of fixture.Mode || []) {
                    let mod = {
                        "name": mode.$.Name
                    };

                    let physical = {};

                    if ("Dimensions" in mode.Physical[0]) {
                        const dimWidth = parseInt(mode.Physical[0].Dimensions[0].$.Width);
                        const dimHeight = parseInt(mode.Physical[0].Dimensions[0].$.Height);
                        const dimDepth = parseInt(mode.Physical[0].Dimensions[0].$.Depth);
                        if ((dimWidth != 0 || dimHeight != 0 || dimDepth != 0)
                            && (!fix.physical.dimensions || fix.physical.dimensions[0] != dimWidth || fix.physical.dimensions[1] != dimHeight || fix.physical.dimensions[2] != dimDepth)) {
                            physical.dimensions = [dimWidth, dimHeight, dimDepth];
                        }

                        const weight = parseFloat(mode.Physical[0].Dimensions[0].$.Weight);
                        if (weight != 0.0 && (fix.physical.weight != weight))
                            physical.weight = weight;
                    }

                    if ("Technical" in mode.Physical[0]) {
                        const power = parseInt(mode.Physical[0].Technical[0].$.PowerConsumption);
                        if (power != 0 && (fix.physical.power != power))
                            physical.power = power;

                        const DMXconnector = mode.Physical[0].Technical[0].$.DmxConnector;
                        if (DMXconnector != "" && fix.physical.DMXconnector != DMXconnector)
                            physical.DMXconnector = DMXconnector;
                    }

                    if ("Bulb" in mode.Physical[0]) {
                        let bulbData = {};
                        const bulbType = mode.Physical[0].Bulb[0].$.Type;
                        if (bulbType != "" && (!fix.physical.bulb || fix.physical.bulb.type != bulbType))
                            bulbData.type = bulbType;
                        const bulbColorTemp = parseInt(mode.Physical[0].Bulb[0].$.ColourTemperature);
                        if (bulbColorTemp != 0 && (!fix.physical.bulb || fix.physical.bulb.colorTemperature != bulbColorTemp))
                            bulbData.colorTemperature = bulbColorTemp;
                        const bulbLumens = parseInt(mode.Physical[0].Bulb[0].$.Lumens);
                        if (bulbLumens != 0 && (!fix.physical.bulb || fix.physical.bulb.lumens != bulbLumens))
                            bulbData.lumens = bulbLumens;
                        if (JSON.stringify(bulbData) != '{}')
                            physical.bulb = bulbData;
                    }

                    if ("Lens" in mode.Physical[0]) {
                        let lensData = {};
                        const lensName = mode.Physical[0].Lens[0].$.Name;
                        if (lensName != "" && (!fix.physical.lens || fix.physical.lens.name != lensName))
                            lensData.name = lensName;
                        const lensDegMin = parseFloat(mode.Physical[0].Lens[0].$.DegreesMin);
                        const lensDegMax = parseFloat(mode.Physical[0].Lens[0].$.DegreesMax);
                        if ((lensDegMin != 0.0 || lensDegMax != 0.0)
                            && (!fix.physical.lens || !fix.physical.lens.degreesMinMax || fix.physical.lens.degreesMinMax[0] != lensDegMin || fix.physical.lens.degreesMinMax[1] != lensDegMax))
                            lensData.degreesMinMax = [lensDegMin, lensDegMax];
                        if (JSON.stringify(lensData) != '{}')
                            physical.lens = lensData;
                    }

                    if ("Focus" in mode.Physical[0]) {
                        let focusData = {};
                        const focusType = mode.Physical[0].Focus[0].$.Type;
                        if (focusType != "" && (!fix.physical.focus || fix.physical.focus.type != focusType))
                            focusData.type = focusType;
                        const focusPanMax = parseInt(mode.Physical[0].Focus[0].$.PanMax);
                        if (focusPanMax != 0 && (!fix.physical.focus || fix.physical.focus.panMax != focusPanMax))
                            focusData.panMax = focusPanMax;
                        const focusTiltMax = parseInt(mode.Physical[0].Focus[0].$.TiltMax);
                        if (focusTiltMax != 0 && (!fix.physical.focus || fix.physical.focus.tiltMax != focusTiltMax))
                            focusData.tiltMax = focusTiltMax;
                        if (JSON.stringify(focusData) != '{}')
                            physical.focus = focusData;
                    }

                    if (JSON.stringify(physical) != '{}') {
                        if (fix.modes.length == 0) // this is the first mode -> fixture defaults
                            fix.physical = physical;
                        else
                            mod.physical = physical;
                    }

                    mod.channels = [];
                    for (const ch of mode.Channel || []) {
                        mod.channels[parseInt(ch.$.Number)] = ch._;
                    }

                    for (let i in mode.Head || []) {
                        let head = [];

                        if (mode.Head[i].Channel === undefined)
                            continue;

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