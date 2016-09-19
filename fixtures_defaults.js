module.exports = {
    "imports": [], // optional. Contains paths (relative to the working directory) to other fixture JSON files that shall be included
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
                "dimensions": [0, 0, 0], // optional. width, height, depth (in mm)
                "weight": 0.0, // optional. in kg.
                "power": 0, // optional. in W.
                "DMXconnector": "3-pin", // optional. Possible values: "3-pin/5-pin/3-pin and 5-pin/3.5mm stereo jack/Other/free text"
                "bulb": {
                    "colorTemperature": 0, // optional
                    "type": "", // optional. e.g. "LED"
                    "lumens": 0 // optional
                },
                "lens": {
                    "name": "Other", // optional. Possible values: "PC/Fresnel/Other/free text"
                    "degreesMinMax": [0.0, 0.0] // optional. Range 0..360 (in deg)
                },
                "focus": {
                    "type": "Fixed", // optional. Possible values: "Fixed/Head/Mirror/Barrel/free text"
                    "panMax": 0, // optional. in deg.
                    "tiltMax": 0 // optional. in deg.
                }
            },
            "availableChannels": { // required
                "ch1": {
                    "name": null, // optional. default: channel object key (here: "ch1")
                    "type": "Intensity", // optional. Possible values: "Intensity/Shutter/Speed/Color/Gobo/Prism/Pan/Tilt/Beam/Effect/Maintenance/Nothing". Note: Use "Color" only for multiple colors in one channel, and "Intensity" else.
                    "color": "Generic", // optional. Possible values: "Generic/Red/Green/Blue/Cyan/Magenta/Yellow/Amber/White/UV/Lime". Note: Only important if "type" is "Intensity"
                    "defaultValue": 0, // optional. DMX channel value
                    "highlightValue": 0, // optional. DMX channel value
                    "invert": false, // optional
                    "constant": false, // optional
                    "crossfade": false, // optional
                    "precendence": "LTP", // optional. Possible values: "HTP/LTP"
                    "capabilities": [ // optional
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
            "multiByteChannels": [], // optional. May contain arrays with corresponding channels, the most significant first. e.g. [["pan", "pan-fine"], ["tilt", "tilt-fine"]]
            "heads": {}, // optional. Group channels used for each head. e.g. { "Head 1": ["ch4", "ch5"], "Head 2": ["ch6", "ch7"] }
            "modes": [ // required
                {
                    "name": null, // required. e.g. "7-channel Mode",
                    "shortName": null, // optional. Default: name. e.g. "7ch"
                    "physical": {}, // optional. overrides fixture defaults.
                    "channels": null // required. Use channels defined in availableChannels. Unused channels can be null, e.g. ["ch1", null, "ch3"]
                }
            ]
        }
    ]
};