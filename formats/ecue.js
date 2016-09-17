'use strict';

const fs = require('fs');
const path = require('path');
const extend = require('extend');

const defaults = require(['..', 'fixtures_defaults.js'].join(path.sep));

module.exports.format = function formatEcue(manufacturers, fixtures, localOutDir) {
    const timestamp = new Date().toISOString().replace(/T/, '#').replace(/\..+/, '');
    let str = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    str += `<Document Owner="user" TypeVersion="2" SaveTimeStamp="${timestamp}">\n`;
    str += '    <Library>\n'
    str += '        <Fixtures>\n';

    const manufacturerShortNames = Object.keys(manufacturers).sort();

    for (const manufacturer of manufacturerShortNames) {
        const manData = extend({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}">\n`;

        for (const fixture of fixtures) {
            if (fixture.manufacturer != manufacturer) continue;

            let fixData = extend({}, defaults.fixtures[0], fixture);
            if (fixData.shortName == null) {
                fixData.shortName = fixData.name;
            }

            for (const mode of fixture.modes) {
                let modeData = extend({}, defaults.fixtures[0].modes[0], mode);
                if (modeData.shortName == null) {
                    modeData.shortName = modeData.name;
                }

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

                    const hasCapabilities = (channel.capabilities !== undefined);

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

    for (const manufacturer of manufacturerShortNames) {
        const manData = extend({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`;
    }
    str += '        </Tiles>\n';
    str += '    </Library>\n';
    str += '</Document>\n';

    const outFile = [localOutDir, 'UserLibrary.xml'].join(path.sep);
    fs.writeFile(outFile, str, (writeError) => {
        if (writeError) {
            die(`Error writing to file "${outFile}", exiting.`, writeError);
        }
        console.log(`File "${outFile}" successfully written.`);
    });
}

module.exports.import = function importEcue(str, filename) {
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

            try {
                for (const manufacturer of xml.Document.Library[0].Fixtures[0].Manufacturer) {
                    const manName = manufacturer.$.Name;
                    out.manufacturers[manName] = {
                        "name": manName
                    };
                    if (manufacturer.$.Comment != "")
                        out.manufacturers[manName].comment = manufacturer.$.Comment;

                    if (manufacturer.$.Web != "")
                        out.manufacturers[manName].website = manufacturer.$.Web;

                    if (!manufacturer.Fixture) {
                        continue;
                    }

                    for (const fixture of manufacturer.Fixture) {
                        let fix = {
                            "name": fixture.$.Name,
                            "availableChannels": {},
                            "modes": [
                                {
                                    "name": "Default mode",
                                    "channels": []
                                }
                            ]
                        };
                        if (fixture.$.NameShort != "")
                            fix.shortName = fixture.$.NameShort;

                        if (fixture.$.Comment != "")
                            fix.comment = fixture.$.Comment;

                        let physical = {};

                        if (fixture.$.Weight != "0")
                            physical.weight = parseFloat(fixture.$.Weight);

                        if (fixture.$.Power != "0")
                            physical.power = parseInt(fixture.$.Power);

                        if (fixture.$.DimWidth != "10" && fixture.$.DimHeight != "10" && fixture.$.DimDepth != "10")
                            physical.dimensions = [parseInt(fixture.$.DimWidth), parseInt(fixture.$.DimHeight), parseInt(fixture.$.DimDepth)];

                        if (JSON.stringify(physical) !== '{}')
                            fix.physical = physical;


                        let channels = [];

                        if (fixture.ChannelIntensity)
                            channels = channels.concat(fixture.ChannelIntensity);
                        if (fixture.ChannelColor)
                            channels = channels.concat(fixture.ChannelColor);
                        if (fixture.ChannelBeam)
                            channels = channels.concat(fixture.ChannelBeam);
                        if (fixture.ChannelFocus)
                            channels = channels.concat(fixture.ChannelFocus);

                        channels = channels.sort((a, b) => {
                            if (a.$.DmxByte0 < b.$.DmxByte0)
                                return -1;

                            if (a.$.DmxByte0 > b.$.DmxByte0)
                                return 1;

                            return 0;
                        });

                        for (const channel of channels) {

                            // TODO: handle double byte channels

                            let shortName = channel.$.Name;
                            if (fix.availableChannels[shortName]) {
                                shortName += Math.random().toString(36).substr(2, 5);
                            }
                            fix.modes[0].channels.push(shortName);
                            fix.availableChannels[shortName] = {
                                "name": channel.$.Name
                            };
                            let ch = fix.availableChannels[shortName];

                            if (channel.$.DefaultValue != "0")
                                ch.highlightValue = parseInt(channel.$.DefaultValue);

                            if (channel.$.Highlight != "0")
                                ch.highlightValue = parseInt(channel.$.Highlight);

                            ch.constant = (channel.$.Constant == "1");
                            ch.crossfade = (channel.$.Crossfade == "1");
                            ch.invert = (channel.$.Invert == "1");
                            ch.precendence = channel.$.Precedence;

                            ch.type = 'Intensity';
                            if (fixture.ChannelColor && fixture.ChannelColor.indexOf(channel) != -1) {
                                if (channel.Range && channel.Range.length > 1) {
                                    ch.type = 'Color';
                                }
                                else {
                                    ch.color = 'Generic';
                                    ['Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow', 'Amber', 'White', 'UV', 'Lime'].some((color) => {
                                        if (channel.$.Name.toLowerCase().includes(color.toLowerCase())) {
                                            ch.color = color;
                                            return true;
                                        }
                                        return false;
                                    });
                                }
                            }
                            else if (channel.$.Name.toLowerCase().includes('speed')) {
                                ch.type = 'Speed';
                            }
                            else if (channel.$.Name.toLowerCase().includes('gobo')) {
                                ch.type = 'Gobo';
                            }
                            else if (channel.$.Name.toLowerCase().includes('program') || channel.$.Name.toLowerCase().includes('effect')) {
                                ch.type = 'Effect';
                            }
                            else if (channel.$.Name.toLowerCase().includes('prism')) {
                                ch.type = 'Prism';
                            }
                            else if (channel.$.Name.toLowerCase().includes('shutter') || channel.$.Name.toLowerCase().includes('strob')) {
                                ch.type = 'Shutter';
                            }
                            else if (channel.$.Name.toLowerCase().includes('pan')) {
                                ch.type = 'Pan';
                            }
                            else if (channel.$.Name.toLowerCase().includes('tilt')) {
                                ch.type = 'Tilt';
                            }
                            else if (fixture.ChannelBeam && fixture.ChannelBeam.indexOf(channel) != -1) {
                                ch.type = 'Beam';
                            }

                            if (channel.Range) {
                                ch.capabilities = [];

                                for (let range of channel.Range) {
                                    let cap = {
                                        "name": range.$.Name,
                                        "range": [parseInt(range.$.Start), parseInt(range.$.End)]
                                    };
                                    
                                    if (range.$.AutoMenu != "1")
                                        cap.showInMenu = false;

                                    if (range.$.Centre != "0")
                                        cap.center = true;

                                    ch.capabilities.push(cap);
                                }
                            }
                        }

                        out.fixtures.push(fix);
                    }
                }
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