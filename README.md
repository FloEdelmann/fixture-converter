# DMX Fixture converter

## 🚫 DISCONTINUED!

➡ See [Open Fixture Library](https://github.com/OpenLightingProject/open-fixture-library) for successor project.

---

Creating fixture files is relatively easy for most DMX control software, as they offer graphical editors for their proprietary formats. But what if you want to try another program?

For this purpose, I created this little script that uses a JSON file to store all fixture data. Other files may be generated from this format or imported into it.


## Supported formats

### Internal JSON

See [fixtures_defaults.js](fixtures_defaults.js) or look at the [fixtures/ directory](fixtures/) to learn how the JSON structure used by this script looks like.

### e:cue (`ecue`)

**Import:** Yes  
**Export:** Yes

**Website:** [http://www.ecue.com/](http://www.ecue.com/index.php?id=502)

**Where do I find my previous fixture definitions?**  
Main Library: `C:\ProgramData\ecue\Library V7.0\MainLibrary.xml`  
User Library: `C:\Documents and Settings\[Your User]\AppData\Local\ecue\Library V7.0\UserLibrary.xml`

### QLC+ (`qlcplus`)

**Import:** Yes  
**Export:** Yes

**Website:** http://www.qlcplus.org/

**Where do I find my previous fixture definitions?**  
Main Library: `/usr/share/qlcplus/fixtures` (Linux)  
User Library: `~/.qlcplus/fixtures` (Linux)


## Dependencies

* [Node.js](https://nodejs.org/en/) (>= v4)

**Node.js Modules:**
* [node-getopt](https://www.npmjs.com/package/node-getopt)
* [mkdirp](https://www.npmjs.com/package/mkdirp)
* [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js)
* [color-names](https://www.npmjs.com/package/color-names)
* [semver](https://www.npmjs.com/package/semver)

```
npm install
```

## Usage

`./fixtures_convert.js --help` lists all possible options.

**Note:** This script uses [destructuring](http://stackoverflow.com/questions/17379277/destructuring-in-node-js). For older versions of Node.js, you will have to use `node --harmony_destructuring fixtures_convert.js --help`.

### Examples

**Typical use:** `./fixtures_convert.js -f qlcplus`  
formats `fixtures.json` as *QLC+* and writes the resulting fixture definition `.qxf` files to `out/qlcplus/`

**Import:** `./fixtures_convert.js -i UserLibrary.xml -f ecue -o out/%FORMAT%/%MANUFACTURER%.json`  
imports `UserLibrary.xml` as *e:cue* format and writes the resulting JSON files (separated by manufacturer) to `out/ecue/%MANUFACTURER%.json`


## Contributing

Feel free to add your own output formats and / or fixtures. Just create a pull request!

### New fixtures

Possibly, the best way is to create a fixture definition in QLC+'s fixture editor (try to fill in all possible information) and then import it using `./fixtures_convert.js -i myfile.qxf -f qlcplus`. The resulting JSON file in the *out* directory will probably contain some errors (especially when importing 16bit channels), so check it against the [fixtures_default.js](fixtures_default.js). Please also include a manual URL so that somebody can check your new fixture.

### New formats

Each format module may look like this:

```js
// required
module.exports.defaultFileExt = 'xml';
module.exports.defaultFileName = '%MANUFACTURER%-%FIXTURE%.xml';

module.exports.formatName = 'e:cue'; // optional

// both functions are optional
module.exports.export = function(manufacturers, fixtures, optionsOutput) {
    // optionsOutput contains the -o command line parameter with %FORMAT% already replaced
    ...
}
module.exports.import = function(str, filename) {
    // str is the string to be parsed, filename is just for helpful error messages
    ...
    // use a promise to allow asynchronous return values
    return new Promise((resolve, reject) => {
        ...
        resolve(objectToConvertToJSON);
    });
}

// optional
function privateHelperFunction() { ... }
```

Save it as `formats/[formatname].js`. Your module will automatically hook into the main [fixtures_convert.js](fixtures_convert.js), so you won't have to bother with command line arguments.
