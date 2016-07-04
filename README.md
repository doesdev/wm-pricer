# wm-pricer   [![npm version](https://badge.fury.io/js/wm-pricer.svg)](http://badge.fury.io/js/wm-pricer)   [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

An inelegant way to check brickseek for Walmart inventory based on a query to Walmart API. It will open a the brickseek URL for each matching result in your default browser.

Ideally PhantomJS would be employed to automate the filtering process as well as some algorithm's to identify anomalous prices at stores. But I'm not doing that. Pull requests welcomed.

### Requires [Walmart API key](https://developer.walmartlabs.com/member)

## install
`npm i wm-pricer`

## usage

Only one function exported with signature (apiKey, query, start).

The api limits to 25 results each time. So the start arg allows pagination (i.e. for page 2 start at 26).

Provide API key (required)
```javascript
const wmPricer = require('wm-pricer')

wmPricer('someapikey', '4k tv', 1)
```
