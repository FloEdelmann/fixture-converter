'use strict';

const fs = require('fs');
const path = require('path');

const defaults = require(path.join(__dirname, '..', 'fixtures_defaults.js'));

module.exports.export = function formatEcue(manufacturers, fixtures, localOutDir) {
    const timestamp = new Date().toISOString().replace(/T/, '#').replace(/\..+/, '');
    let str = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    str += `<Document Owner="user" TypeVersion="2" SaveTimeStamp="${timestamp}">\n`;
    str += '    <Library>\n'
    str += '        <Fixtures>\n';

    const manufacturerShortNames = Object.keys(manufacturers).sort();

    for (const manufacturer of manufacturerShortNames) {
        const manData = Object.assign({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}">\n`;

        for (const fixture of fixtures) {
            if (fixture.manufacturer != manufacturer) continue;

            let fixData = Object.assign({}, defaults.fixtures[0], fixture);
            if (fixData.shortName == null) {
                fixData.shortName = fixData.name;
            }

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
                        && mode.channels.includes(multiByteChannels[0])
                        && mode.channels.includes(multiByteChannels[1])) {
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

                    const hasCapabilities = (channel.capabilities !== undefined);

                    str += `                    <Channel${chType} Name="${chData.name}" DefaultValue="${chData.defaultValue}" Highlight="${chData.highlightValue}" Deflection="0" DmxByte0="${dmxByteHigh+1}" DmxByte1="${dmxByteLow+1}" Constant="${chData.constant ? 1 : 0}" Crossfade="${chData.crossfade ? 1 : 0}" Invert="${chData.invert ? 1 : 0}" Precedence="${chData.precendence}" ClassicPos="${viewPosCount++}"` + (hasCapabilities ? '' : ' /') + '>\n';

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
        }
        str += '            </Manufacturer>\n';
    }
    str += '        </Fixtures>\n';
    str += '        <Tiles>\n';

    for (const manufacturer of manufacturerShortNames) {
        const manData = Object.assign({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`;
    }
    str += '        </Tiles>\n';
    str += '    </Library>\n';
    str += '</Document>\n';

    const outFile = path.join(localOutDir, 'UserLibrary.xml');
    fs.writeFile(outFile, str, (writeError) => {
        if (writeError) {
            die(`Error writing to file "${outFile}", exiting.`, writeError);
        }
        console.log(`File "${outFile}" successfully written.`);
    });
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

                            if (fixture.ChannelColor && fixture.ChannelColor.includes(channel)) {
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
                            else if (fixture.ChannelBeam && fixture.ChannelBeam.includes(channel))
                                ch.type = 'Beam';
                            else if (!fixture.ChannelIntensity || fixture.ChannelIntensity.includes(channel)) // not even a default Intensity channel
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


// polyfill to support Node v5 and below
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/) {
    'use strict';
    if (this == null) {
      throw new TypeError('Array.prototype.includes called on null or undefined');
    }
    
    var O = Object(this);
    var len = parseInt(O.length, 10) || 0;
    if (len === 0) {
      return false;
    }
    var n = parseInt(arguments[1], 10) || 0;
    var k;
    if (n >= 0) {
      k = n;
    } else {
      k = len + n;
      if (k < 0) {k = 0;}
    }
    var currentElement;
    while (k < len) {
      currentElement = O[k];
      if (searchElement === currentElement ||
         (searchElement !== searchElement && currentElement !== currentElement)) { // NaN !== NaN
        return true;
      }
      k++;
    }
    return false;
  };
}