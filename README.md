# DMX Fixture converter

Creating fixture files is relatively easy for most DMX control software, as they offer editors for their proprietary formats. But what if you want to try another program?

For this purpose, I created this little script that converts a JSON file with all fixture data to various output formats.

## Supported output formats

* [e:cue](http://www.ecue.de/)
* [QLC+](http://www.qlcplus.org/)


## How does the input format have to look like?

Just see [fixtures_defaults.js](fixtures_defaults.js).


## Dependencies

* [Node.js](https://nodejs.org/en/)
* [node-getopt](https://www.npmjs.com/package/node-getopt)
* [mkdirp](https://www.npmjs.com/package/mkdirp)
* [extend](https://www.npmjs.com/package/extend)

```
npm install node-getopt mkdirp extend
```

## Usage

`./fixtures_convert.js --help` lists all possible options.

**Note:** This script uses [destructuring](http://stackoverflow.com/questions/17379277/destructuring-in-node-js). For older versions of Node.js, you will have to use `node --harmony_destructuring fixtures_convert.js --help`.


## Contributing

Feel free to add your own output formats and / or fixtures. Just create a pull request!