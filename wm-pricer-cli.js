#! /usr/bin/env node
'use strict'

// Setup
const wmPricer = require('./index')
const prettyJson = require('prettyjson')
const fs = require('fs')
const path = require('path')
const optsAry = ['apiKey', 'query', 'zip', 'limit', 'start']
const pjOpts = { numberColor: 'yellow' }
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
const man = `
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
  -p, --page      Result set page to return
  -s, --store     Search using storeQuery api
  -d, --diff      In store price difference threshold
    (i.e. only show results with X percent lower price in store than online)

To store apiKey and optionally zip
  ~ wmp -r -k xyz123 -z 33803

If apiKey is stored and no other options supplied you can call with
  ~ wmp zip query

If apiKey and zip is stored and no other options supplied you can call with
  ~ wmp query
`

const init = () => {
  // Establish params
  let env, apiKey, query, zip, limit, page, store, fromStored, diff, sq, help
  process.argv.forEach((e, i) => {
    if (e.match(/-h|--help/)) return (help = true)
    if (e.match(/-r|--remember/)) store = true
    if (e.match(/-k|--apiKey/)) apiKey = process.argv[i + 1]
    else if (e.match(/-q|--query/)) query = process.argv[i + 1]
    else if (e.match(/-z|--zip/)) zip = process.argv[i + 1]
    else if (e.match(/-l|--limit/)) limit = parseInt(process.argv[i + 1], 10)
    else if (e.match(/-p|--page/)) page = parseInt(process.argv[i + 1], 10)
    else if (e.match(/-s|--store/)) sq = true
    else if (e.match(/-d|--diff/)) diff = parseInt(process.argv[i + 1], 10)
  })
  if (help) return console.log(man)
  try {
    env = require('./env.json')
    fromStored = true
  } catch (e) {
    env = process.env || {}
  }
  if (!(apiKey || query || zip || limit || page)) {
    const firstIsNum = process.argv[2].match(/^\d+$/)
    zip = process.argv[firstIsNum ? 2 : 3]
    query = process.argv[firstIsNum ? 3 : 2]
  }
  const start = ((page || 1) * (limit || 25) + 1) - (limit || 25)
  const opts = { apiKey, query, zip, limit, start }

  // Store vars if that flag is set
  if (store) {
    if (fromStored) optsAry.forEach((k) => { opts[k] = opts[k] || env[k] })
    fs.writeFileSync(path.resolve(__dirname, 'env.json'), JSON.stringify(opts))
  }
  // Do that dang thing
  if (!(store && fromStored)) {
    optsAry.forEach((k) => { opts[k] = opts[k] || env[k] })
  }
  if (sq) {
    if (diff) opts.minDiff = diff
    const wmp = wmPricer.api.new(opts)
    wmp.on('store-query-done', (d) => console.log(prettyJson.render(d, pjOpts)))
    wmp.storeQuery(opts)
    return
  }
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
      e.inventory.sort((a, b) => a.price - b.price)
      aryOut[i] = {}
      propsOrder.forEach((k) => { aryOut[i][k] = e[k] })
    })
    aryOut = aryOut.filter((i) => i)
    aryOut.sort((a, b) => b.variancePercent - a.variancePercent)
    console.log(prettyJson.render(aryOut, pjOpts))
  })
}

init()
