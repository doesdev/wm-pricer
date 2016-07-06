# wm-pricer   [![npm version](https://badge.fury.io/js/wm-pricer.svg)](http://badge.fury.io/js/wm-pricer)   [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

An inelegant helper for checking brickseek for Walmart inventory based on a query to Walmart API.

### Requires [Walmart API key](https://developer.walmartlabs.com/member)

## install
`npm i wm-pricer`

## usage

Only one function exported with signature (opts, callback). Callback will be invoked with (err, data) with data being an array of item objects.

The api limits to 25 results each time. So the start arg allows pagination (i.e. for page 2 start at 26).

Provide API key (required)
```javascript
const wmPricer = require('wm-pricer')
const opts = {apiKey: 'someapikey', zip: 33803, query: '4k tv', start: 1}
wmPricer(opts, console.log)
```
