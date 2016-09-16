# Fixture converter

Creating fixture files is relatively easy for most DMX control software, as they offer editors for their proprietary formats. But what if you want to try another program?

For this purpose, I created this little script that converts a JSON file with all fixture data to various output formats.

## Supported output formats

* [e:cue](http://www.ecue.de/)
* [QLC+](http://www.qlcplus.org/)

## How does the input format have to look like?

Just see [fixtures_convert.js, line 13](fixtures_convert.js#L13).
