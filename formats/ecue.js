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

    for (const manufacturer of manufacturerShortNames) {
        const manData = extend({}, defaults.manufacturers.shortName, manufacturers[manufacturer]);

        str += `            <Manufacturer _CreationDate="${timestamp}" _ModifiedDate="${timestamp}" Header="" Name="${manData.name}" Comment="${manData.comment}" Web="${manData.website}" />\n`;
    }
    str += '        </Tiles>\n';
    str += '    </Library>\n';
    str += '</Document>\n';

    let outFile = [localOutDir, 'UserLibrary.xml'].join(path.sep);

    fs.writeFile(outFile, str, (writeError) => {
        if (writeError) {
            die(`Error writing to file "${outFile}", exiting.`, writeError);
        }
        console.log(`File "${outFile} successfully written.`);
    });
}

function die(errorStr, logStr) {
    console.error(errorStr);
    if (logStr)
        console.log(logStr);
    process.exit(1);
}