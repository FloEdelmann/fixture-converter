'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const mkdirp = require('mkdirp');

const defaults = require(path.join(__dirname, '..', 'fixtures_defaults.js'));

module.exports.defaultFileName = 'UserLibrary.xml';

module.exports.export = function formatEcue(manufacturers, fixtures, optionsOutput) {
    const timestamp = new Date().toISOString().replace(/T/, '#').replace(/\..+/, '');

    let outFixtures = [];

    for (const fixture of fixtures) {
        let fixData = Object.assign({}, defaults.fixtures[0], fixture);
        if (fixData.shortName == null) {
            fixData.shortName = fixData.name;
        }

        manufacturers[fixData.manufacturer] = Object.assign({}, defaults.manufacturers.shortName, manufacturers[fixData.manufacturer]);
        if (!manufacturers[fixData.manufacturer].name)
            manufacturers[fixData.manufacturer].name = fixData.manufacturer;

        let str = '';

        for (const mode of fixture.modes) {
            let modeData = Object.assign({}, defaults.fixtures[0].modes[0], mode);
            if (modeData.shortName == null) {
                modeData.shortName = modeData.name;
            }

            const useName = fixData.name + (fixture.modes.length == 1 ? '' : ` (${modeData.shortName})`);
            const useComment = fixData.comment + (fixture.modes.length == 1 ? '' : ` (${modeData.name})`);

            const physicalData = Object.assign({}, defaults.fixtures[0].physical, fixData.physical, modeData.physical);
            const bulbData = Object.assign({}, defaults.fixtures[0].physical.bulb, physicalData.bulb);
            const lensData = Object.assign({}, defaults.fixtures[0].physical.lens, physicalData.lens);
            const focusData = Object.assign({}, defaults.fixtures[0].physical.focus, physicalData.focus);

            str += `                <Fixture _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${useName}" NameShort="${fixData.shortName}" Comment="${useComment}" AllocateDmxChannels="${mode.channels.length}" Weight="${physicalData.weight}" Power="${physicalData.power}" DimWidth="${physicalData.dimensions[0]}" DimHeight="${physicalData.dimensions[1]}" DimDepth="${physicalData.dimensions[2]}">\n`;

            let viewPosCount = 1;
            for (const dmxCount in mode.channels) {
                let chKey = mode.channels[dmxCount];

                if (chKey === null) {
                    // we already handled this as part of a 16-bit channel, so just skip
                    continue;
                }

                let doubleByte = false;
                const multiByteChannels = getCorrespondingMultiByteChannels(chKey, fixData);
                if (multiByteChannels != null
                    && mode.channels.indexOf(multiByteChannels[0]) != -1
                    && mode.channels.indexOf(multiByteChannels[1]) != -1) {
                    // it is a 16-bit channel and both 8-bit parts are used in this mode
                    chKey = multiByteChannels[0];
                    doubleByte = true;
                }

                const channel = fixture.availableChannels[chKey];

                if (channel === undefined) {
                    die(`Channel "${chKey}" not found in fixture "${fixData.name}", exiting.`);
                }

                let chData = Object.assign({}, defaults.fixtures[0].availableChannels["Unique channel name"], channel);

                if (!chData.name)
                    chData.name = chKey;

                let chType = '';
                switch (chData.type) {
                    case 'MultiColor':
                    case 'SingleColor':
                        chType = 'Color';
                        break;
                    case 'Beam':
                    case 'Shutter':
                    case 'Strobe':
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

                let dmxByteLow = dmxCount;
                let dmxByteHigh = -1;

                if (doubleByte) {
                    const chKeyLsb = multiByteChannels[1];
                    const channelLsb = fixture.availableChannels[chKeyLsb];

                    if (channelLsb === undefined) {
                        die(`Channel "${chKeyLsb}" not found in fixture "${fixData.name}", exiting.`);
                    }
                    const chDataLsb = Object.assign({}, defaults.fixtures[0].availableChannels["Unique channel name"], channelLsb);

                    chData.defaultValue *= 256;
                    chData.defaultValue += chDataLsb.defaultValue;

                    chData.highlightValue *= 256;
                    chData.highlightValue += chDataLsb.highlightValue;

                    dmxByteLow = mode.channels.indexOf(chKeyLsb);
                    dmxByteHigh = mode.channels.indexOf(chKey);

                    // mark other part of 16-bit channel as already handled
                    mode.channels[Math.max(dmxByteHigh, dmxByteLow)] = null;
                }

                dmxByteLow++;
                dmxByteHigh++;

                const hasCapabilities = (channel.capabilities && true);

                str += `                    <Channel${chType} Name="${chData.name}" DefaultValue="${chData.defaultValue}" Highlight="${chData.highlightValue}" Deflection="0" DmxByte0="${dmxByteLow}" DmxByte1="${dmxByteHigh}" Constant="${chData.constant ? 1 : 0}" Crossfade="${chData.crossfade ? 1 : 0}" Invert="${chData.invert ? 1 : 0}" Precedence="${chData.precendence}" ClassicPos="${viewPosCount++}"` + (hasCapabilities ? '' : ' /') + '>\n';

                if (hasCapabilities) {
                    for (const cap of channel.capabilities) {
                        const capData = Object.assign({}, defaults.fixtures[0].availableChannels["Unique channel name"].capabilities[0], cap);

                        str += `                        <Range Name="${capData.name}" Start="${capData.range[0]}" End="${capData.range[1]}" AutoMenu="${capData.showInMenu ? 1 : 0}" Centre="${capData.center ? 1 : 0}" />\n`;
                    }
                    str += `                    </Channel${chType}>\n`;
                }
            }
            str += '                </Fixture>\n';
        }

        outFixtures.push({
            "manufacturer": fixData.manufacturer,
            "name": fixData.name,
            "str": str
        });
    }

    let template = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    template += `<Document Owner="user" TypeVersion="2" SaveTimeStamp="${timestamp}">\n`;
    template += '    <Library>\n'
    template += '        <Fixtures>\n';
    template += '%s';
    template += '        </Fixtures>\n';
    template += '        <Tiles>\n';
    template += '%s';
    template += '        </Tiles>\n';
    template += '    </Library>\n'
    template += '</Document>\n';

    let outputfiles = [];

    if (optionsOutput.includes('%FIXTURE%')) {
        for (const fix of outFixtures) {
            const manData = manufacturers[fix.manufacturer];
            const filename = optionsOutput
                .replace(/%FIXTURE%/g, fix.name.replace(/\s+/g, '-'))
                .replace(/%MANUFACTURER%/g, manData.name.replace(/\s+/g, '-'));

            const str = util.format(template,
                `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}">\n` +
                fix.str +
                '            </Manufacturer>\n',
                `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`
            );

            outputfiles.push({
                "filename": filename,
                "str": str
            });
        }
    }
    else if (optionsOutput.includes('%MANUFACTURER%')) {
        for (let man in manufacturers) {
            const manData = manufacturers[man];
            let str = `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}">\n`;

            let i = 0;
            for (const fix of outFixtures) {
                if (fix.manufacturer == man) {
                    str += fix.str;
                    i++;
                }
            }

            if (i > 0) {
                outputfiles.push({
                    "filename": optionsOutput.replace(/%MANUFACTURER%/g, manData.name.replace(/\s+/g, '-')),
                    "str": util.format(template,
                        str + '            </Manufacturer>\n',
                        `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`
                    )
                });
            }
        }
    }
    else {
        let str = '';
        let tilesStr = '';
        for (let man in manufacturers) {
            const manData = manufacturers[man];
            let manStr = `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}">\n`;

            let i = 0;
            for (const fix of outFixtures) {
                if (fix.manufacturer == man) {
                    manStr += fix.str;
                    i++;
                }
            }

            if (i > 0) {
                str += manStr + '            </Manufacturer>\n';
                tilesStr += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`;
            }
        }

        outputfiles.push({
            "filename": optionsOutput,
            "str": util.format(template, str, tilesStr)
        });
    }

    for (const outFile of outputfiles) {
        mkdirp(path.dirname(outFile.filename), (mkdirpError) => {
            if (mkdirpError)
                die(`Could not create directory "${path.dirname(outFile.filename)}", exiting.`, mkdirpError);
            
            fs.writeFile(outFile.filename, outFile.str, (writeError) => {
                if (writeError)
                    die(`Error writing to file "${outFile.filename}", exiting.`, writeError);

                console.log(`File "${outFile.filename}" successfully written.`);
            });
        });
    }
}

module.exports.import = function importEcue(str, filename) {
    const colorNames = require('color-names');
    let colors = {};
    for (const hex in colorNames) {
        colors[colorNames[hex].toLowerCase().replace(/\s/g, '')] = hex;
    }

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
                for (const manufacturer of xml.Document.Library[0].Fixtures[0].Manufacturer || []) {
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

                    for (const fixture of manufacturer.Fixture || []) {
                        let fix = {
                            "manufacturer": manName,
                            "name": fixture.$.Name
                        };
                        if (fixture.$.NameShort != "")
                            fix.shortName = fixture.$.NameShort;

                        if (fixture.$.Comment != "")
                            fix.comment = fixture.$.Comment;

                        let physical = {};

                        if (fixture.$.DimWidth != "10" && fixture.$.DimHeight != "10" && fixture.$.DimDepth != "10")
                            physical.dimensions = [parseInt(fixture.$.DimWidth), parseInt(fixture.$.DimHeight), parseInt(fixture.$.DimDepth)];

                        if (fixture.$.Weight != "0")
                            physical.weight = parseFloat(fixture.$.Weight);

                        if (fixture.$.Power != "0")
                            physical.power = parseInt(fixture.$.Power);

                        if (JSON.stringify(physical) !== '{}')
                            fix.physical = physical;

                        fix.availableChannels = {};
                        fix.multiByteChannels = [];
                        fix.modes = [{
                            "name": `${fixture.$.AllocateDmxChannels}-channel Mode`,
                            "shortName": `${fixture.$.AllocateDmxChannels}ch`,
                            "channels": []
                        }];


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
                            if (parseInt(a.$.DmxByte0) < parseInt(b.$.DmxByte0))
                                return -1;

                            if (parseInt(a.$.DmxByte0) > parseInt(b.$.DmxByte0))
                                return 1;

                            return 0;
                        });

                        for (const channel of channels) {
                            let name = channel.$.Name;
                            let shortName = name;
                            if (fix.availableChannels[shortName]) {
                                shortName += '-' + Math.random().toString(36).substr(2, 5);
                            }

                            let ch = {
                                "name": name,
                                "type": "Intensity"
                            };

                            if (name == shortName)
                                delete ch.name;

                            if (fixture.ChannelColor && fixture.ChannelColor.indexOf(channel) != -1) {
                                if (channel.Range && channel.Range.length > 1) {
                                    ch.type = 'MultiColor';
                                }
                                else {
                                    ch.type = 'SingleColor';
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
                            else if (channel.$.Name.toLowerCase().includes('speed'))
                                ch.type = 'Speed';
                            else if (channel.$.Name.toLowerCase().includes('gobo'))
                                ch.type = 'Gobo';
                            else if (channel.$.Name.toLowerCase().includes('program') || channel.$.Name.toLowerCase().includes('effect'))
                                ch.type = 'Effect';
                            else if (channel.$.Name.toLowerCase().includes('prism'))
                                ch.type = 'Prism';
                            else if (channel.$.Name.toLowerCase().includes('shutter'))
                                ch.type = 'Shutter';
                            else if (channel.$.Name.toLowerCase().includes('strob'))
                                ch.type = 'Strobe';
                            else if (channel.$.Name.toLowerCase().includes('pan'))
                                ch.type = 'Pan';
                            else if (channel.$.Name.toLowerCase().includes('tilt'))
                                ch.type = 'Tilt';
                            else if (fixture.ChannelBeam && fixture.ChannelBeam.indexOf(channel) != -1)
                                ch.type = 'Beam';
                            else if (!fixture.ChannelIntensity || fixture.ChannelIntensity.indexOf(channel) != -1) // not even a default Intensity channel
                                ch.warning = "Please check type!";

                            if (channel.$.DefaultValue != "0")
                                ch.defaultValue = parseInt(channel.$.DefaultValue);

                            if (channel.$.Highlight != "0")
                                ch.highlightValue = parseInt(channel.$.Highlight);

                            if (channel.$.Invert == "1")
                                ch.invert = true;

                            if (channel.$.Constant == "1")
                                ch.constant = true;

                            if (channel.$.Crossfade == "1")
                                ch.crossfade = true;

                            if (channel.$.Precedence == "HTP")
                                ch.precendence = "HTP";

                            if (channel.Range) {
                                ch.capabilities = [];

                                channel.Range.forEach((range, i) => {
                                    let cap = {
                                        "range": [parseInt(range.$.Start), parseInt(range.$.End)],
                                        "name": range.$.Name
                                    };

                                    if (cap.range[1] == -1) {
                                        if (channel.Range[i+1])
                                            cap.range[1] = parseInt(channel.Range[i+1].$.Start) - 1;
                                        else
                                            cap.range[1] = 255;
                                    }

                                    if (cap.range[0] < 0 || cap.range[0] > 255 || cap.range[1] < 0 || cap.range[1] > 255) {
                                        cap.warning = "Out of range!";
                                    }

                                    // try to read a color
                                    let color = cap.name.toLowerCase().replace(/\s/g, '');
                                    if (colors[color]) {
                                        cap.color = colors[color];
                                    }
                                    
                                    if (range.$.AutoMenu != "1")
                                        cap.showInMenu = false;

                                    if (range.$.Centre != "0")
                                        cap.center = true;

                                    ch.capabilities.push(cap);
                                });
                            }

                            fix.availableChannels[shortName] = ch;
                            fix.modes[0].channels[parseInt(channel.$.DmxByte0) - 1] = shortName;

                            if (channel.$.DmxByte1 != "0") {
                                let chLsb = JSON.parse(JSON.stringify(ch)); // clone channel data

                                const shortNameFine = shortName + " fine";
                                if (chLsb.name)
                                    chLsb.name += " fine";

                                ch.defaultValue = Math.floor(ch.defaultValue / 256);
                                chLsb.defaultValue %= 256;

                                ch.highlightValue = Math.floor(ch.highlightValue / 256);
                                chLsb.highlightValue %= 256;

                                fix.multiByteChannels.push([shortName, shortNameFine]);
                                
                                fix.availableChannels[shortNameFine] = chLsb;

                                fix.modes[0].channels[parseInt(channel.$.DmxByte1) - 1] = shortNameFine;
                            }
                        }

                        if (fix.multiByteChannels.length == 0)
                            delete fix.multiByteChannels;

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

function getCorrespondingMultiByteChannels(channelKey, fixture) {
    for (let channelList of fixture.multiByteChannels) {
        for (let channel of channelList) {
            if (channelKey == channel) {
                return channelList;
            }
        }
    }
    return null;
}

function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}