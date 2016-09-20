# DMX Fixture converter

Creating fixture files is relatively easy for most DMX control software, as they offer editors for their proprietary formats. But what if you want to try another program?

For this purpose, I created this little script that converts a JSON file with all fixture data to various output formats.

## Supported formats

* [e:cue](http://www.ecue.de/) (import / export)
* [QLC+](http://www.qlcplus.org/) (export only for now)


## How does the input format have to look like?

Just see [fixtures_defaults.js](fixtures_defaults.js).


## Dependencies

* [Node.js](https://nodejs.org/en/)
* [node-getopt](https://www.npmjs.com/package/node-getopt)
* [mkdirp](https://www.npmjs.com/package/mkdirp)
* [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js)
* [color-names](https://www.npmjs.com/package/color-names)

```
npm install node-getopt mkdirp xml2js color-names
```

## Usage

`./fixtures_convert.js --help` lists all possible options.

**Note:** This script uses [destructuring](http://stackoverflow.com/questions/17379277/destructuring-in-node-js). For older versions of Node.js, you will have to use `node --harmony_destructuring fixtures_convert.js --help`.

### Examples

**Typical use:** `./fixtures_convert.js -f ecue` formats `fixtures.json` as *e:cue* and writes it to `out/ecue/UserLibrary.xml`

**Import:** `./fixtures_convert.js -i UserLibrary.xml -f ecue` imports `UserLibrary.xml` as *e:cue* format and writes the resulting JSON file to `out/ecue/import_YYYY-MM-DD_hh:mm:ss.json`


## Contributing

Feel free to add your own output formats and / or fixtures. Just create a pull request!

### New formats

Each format may implement two functions:

```js
module.exports.export = function(manufacturers, fixtures, localOutDir) { ... }
module.exports.import = function(str, filename) {
    ...
    // use a promise to allow asynchronous return values
    return new Promise((resolve, reject) => {
        ...
        resolve(objectToConvertToJSON);
    });
}
```

Those will get called from [fixtures_convert.js](fixtures_convert.js), so you won't have to bother with command line arguments.