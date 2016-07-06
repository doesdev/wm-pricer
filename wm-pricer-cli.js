#! /usr/bin/env node
'use strict'

// Setup
const wmPricer = require('./index')
const prettyJson = require('prettyjson')
const fs = require('fs')
const path = require('path')
const optsAry = ['apiKey', 'query', 'zip', 'limit', 'start']
const pjOpts = {numberColor: 'yellow'}

// Establish params
let env, apiKey, query, zip, limit, start, store, fromStored
process.argv.forEach((e, i) => {
  if (e.match(/-r|--remember/)) store = true
  if (e.match(/-k|--apiKey/)) apiKey = process.argv[i + 1]
  else if (e.match(/-q|--query/)) query = process.argv[i + 1]
  else if (e.match(/-z|--zip/)) zip = process.argv[i + 1]
  else if (e.match(/-l|--limit/)) limit = process.argv[i + 1]
  else if (e.match(/-s|--start/)) start = process.argv[i + 1]
})
try {
  env = require('./env.json')
  fromStored = true
} catch (e) {
  env = process.env || {}
}
if (!(apiKey || query || zip || limit || start)) {
  let firstIsNum = process.argv[2].match(/^\d+$/)
  zip = process.argv[firstIsNum ? 2 : 3]
  query = process.argv[firstIsNum ? 3 : 2]
}
const opts = {apiKey, query, zip, limit, start}

// Store vars if that flag is set
if (store) {
  if (fromStored) optsAry.forEach((k) => opts[k] = opts[k] || env[k])
  fs.writeFileSync(path.resolve(__dirname, 'env.json'), JSON.stringify(opts))
}
// Do that dang thing
if (!(store && fromStored)) optsAry.forEach((k) => opts[k] = opts[k] || env[k])
wmPricer(opts, (e, d) => {
  e ? console.error(e) : console.log(prettyJson.render(d, pjOpts))
})
