'use strict';

const fs = require('fs');
const path = require('path');
const extend = require('extend');

const defaults = require(['..', 'fixtures_defaults.js'].join(path.sep));

module.exports.format = function formatQLCplus(manufacturers, fixtures, localOutDir) {
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

        let fixData = extend({}, defaults.fixtures[0], fixture);
        if (fixData.shortName == null) {
            fixData.shortName = fixData.name;
        }

        const manData = extend({}, defaults.manufacturers.shortName, manufacturers[fixData.manufacturer]);

        str += ` <Manufacturer>${manData.name}</Manufacturer>\n`;
        str += ` <Model>${fixData.name}</Model>\n`;
        str += ` <Type>${fixData.type}</Type>\n`;

        const chDatas = {};
        for (const channel in fixData.availableChannels) {
            const chData = chDatas[channel] = extend({}, defaults.fixtures[0].availableChannels.ch1, fixData.availableChannels[channel]);

            str += ` <Channel Name="${chData.name}">\n`;
            str += `  <Group Byte="${chData.byte}">${chData.type}</Group>\n`;

            for (const capability of chData.capabilities) {
                const capData = extend({}, defaults.fixtures[0].availableChannels.ch1.capabilities[0], capability);

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

        let physData = extend({}, defaults.fixtures[0].physical, fixData.physical);
        physData.bulb = extend({}, defaults.fixtures[0].physical.bulb, fixData.physical.bulb);
        physData.lens = extend({}, defaults.fixtures[0].physical.lens, fixData.physical.lens);
        physData.focus = extend({}, defaults.fixtures[0].physical.focus, fixData.physical.focus);

        for (const mode of fixData.modes) {
            let modeData = extend({}, defaults.fixtures[0].modes[0], mode);
            modeData.physical = extend({}, physData, modeData.physical);

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
                if (typeof channel != "string") {
                    modeData.channels.splice(i+1, 0, channel[1]);
                    channel = channel[0];
                }
                str += `  <Channel Number="${i}">${chDatas[channel].name}</Channel>\n`;
            }

            for (const head in modeData.heads) {
                const headData = modeData.heads[head];
                str += '  <Head>\n';
                for (const channel of headData) {
                    str += `   <Channel>${modeData.channels.indexOf(channel)}</Channel>\n`;
                }
                str += '  </Head>\n';
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

function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}