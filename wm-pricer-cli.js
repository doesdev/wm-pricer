#! /usr/bin/env node
'use strict'

// Setup
const wmPricer = require('./index')
const prettyJson = require('prettyjson')
const fs = require('fs')
const path = require('path')
const optsAry = ['apiKey', 'query', 'zip', 'limit', 'start']
const pjOpts = {numberColor: 'yellow'}
const isNumber = (n) => Number.isFinite(n) && !Number.isNaN(n)
const propsOrder = [
  'name',
  'itemId',
  'msrp',
  'salePrice',
  'minPrice',
  'variancePercent',
  'modelNumber',
  'upc',
  'bsUrl',
  'inventory'
]

// Establish params
let env, apiKey, query, zip, limit, start, store, fromStored, diff
process.argv.forEach((e, i) => {
  if (e.match(/-r|--remember/)) store = true
  if (e.match(/-k|--apiKey/)) apiKey = process.argv[i + 1]
  else if (e.match(/-q|--query/)) query = process.argv[i + 1]
  else if (e.match(/-z|--zip/)) zip = process.argv[i + 1]
  else if (e.match(/-l|--limit/)) limit = process.argv[i + 1]
  else if (e.match(/-s|--start/)) start = process.argv[i + 1]
  else if (e.match(/-d|--diff/)) diff = parseInt(process.argv[i + 1], 10)
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
wmPricer(opts, (err, data) => {
  if (err) return console.error(err)
  let aryOut = []
  data.forEach((e, i) => {
    e.minPrice = Math.min(...(e.inventory || []).map((i) => i.price))
    e.variancePercent = parseInt(
      100 - ((e.minPrice / (e.salePrice || e.msrp)) * 100), 10
    )
    if (diff && (!isNumber(e.variancePercent) || e.variancePercent < diff)) {
      return null
    }
    aryOut[i] = {}
    propsOrder.forEach((k) => aryOut[i][k] = e[k])
  })
  aryOut.filter((i) => i)
  console.log(prettyJson.render(aryOut, pjOpts))
})
