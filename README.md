# wm-pricer   [![npm version](https://badge.fury.io/js/wm-pricer.svg)](http://badge.fury.io/js/wm-pricer)   [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

An inelegant helper for checking brickseek for Walmart inventory based on a query to Walmart API.

### Requires [Walmart API key](https://developer.walmartlabs.com/member)

## install
`npm i wm-pricer`

## programmatic usage

Only one function exported with signature (opts, callback). Callback will be invoked with (err, data) with data being an array of item objects.

The api limits to 25 results each time. So the start arg allows pagination (i.e. for page 2 start at 26).

Provide API key (required)
```javascript
const WmPricerApi = require('wm-pricer').api
const secrets = require('./secrets.json')
const opts = {zip: 33803, query: '4k tv', start: 1}

const main = async () => {
  let data = await new Promise((resolve, reject) => {
    let wmp = WmPricerApi.new(secrets.apiKey)
    wmp.on('error', reject)
    wmp.once('store-query-done', resolve)
    wmp.storeQuery(opts)
  })
}
```

## cli usage
`npm i -g wm-pricer`

`wmp -h`

or

```
WM-Pricer
===========
usage:
  wmp [options]
  wmp [zip] query

options:
  -r, --remember  Store options (i.e. store apiKey / zip for future calls)
  -k, --apiKey    Required to be set either when called or stored for subsequent calls
  -q, --query     Search terms (use double quotes if query contains whitespace)
  -z, --zip       Zip code to search within (50 mile radius)
  -l, --limit     Number of results to return (up to 25, limited by WM API)
  -s, --start     Result to start at, for pagination
  -d, --diff      In store price difference threshold
    (i.e. only show results with X percent lower price in store than online)

To store apiKey and optionally zip
  ~ wmp -r -k xyz123 -z 33803

If apiKey is stored and no other options supplied you can call with
  ~ wmp zip query

If apiKey and zip is stored and no other options supplied you can call with
  ~ wmp query
```
