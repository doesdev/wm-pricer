'use strict'

// Setup
const util = require('util')
const Event = require('events').EventEmitter
const wmApi = require('walmart')
const http = require('http')
const cheerio = require('cheerio')
const isNumber = (n) => Number.isFinite(n) && !Number.isNaN(n)
const keepProps = ['itemId', 'name', 'msrp', 'salePrice', 'modelNumber', 'upc']
const merge = (a, b, preferA) => {
  if (!a || typeof a !== 'object') a = {}
  if (!b) return a
  if (typeof b !== 'object') b = {}
  Object.keys(b).forEach((k) => { a[k] = preferA ? a[k] || b[k] : b[k] })
  return a
}
const model = [
  'name',
  'itemId',
  'msrp',
  'salePrice',
  'maxPrice',
  'minPrice',
  'variancePercent',
  'modelNumber',
  'upc',
  'url',
  'bsUrl',
  'inventory',
  'thumbnail'
]
const storesByZip = {}

module.exports = WmPricer

// Constructor
function WmPricer (opts) {
  const self = this
  const noArgErr = 'Missing required argument (opts Object or apiKey String)'
  if (!opts) throw new Error(noArgErr)
  if (typeof opts === 'string') opts = { apiKey: opts }
  self.apiKey = opts.apiKey
  if (!self.apiKey) throw new Error('API key is required in opts')
  self.zip = opts.zip || 33803
  self.query = opts.query || '4k tv'
  self.page = opts.page || 1
  self.limit = opts.limit
  self.wmOnline = {}
  self.wmStore = {}
  self.wm = wmApi(self.apiKey)
  return self
}

util.inherits(WmPricer, Event)

// Class methods
WmPricer.new = (opts) => new WmPricer(opts)

// Instance methods
WmPricer.prototype.storeQuery = function (opts) {
  const self = this
  const handleErr = (err) => self.emit('error', err)
  opts = merge(opts || {}, self, true)
  const diff = opts.minDiff
  let tmpList = []
  const itemsObj = {}
  const processThenPush = () => {
    tmpList.forEach((e) => {
      if (!e.inventory || e.inventory.quantity < 1) return
      const id = (e.productId || {}).WWWItemId
      const tmpObj = itemsObj[id] = itemsObj[id] || {}
      tmpObj.itemId = id
      tmpObj.url = `http://www.walmart.com/ip/${id}`
      tmpObj.bsUrl = `http://brickseek.com/walmart-inventory-checker?sku=${id}`
      tmpObj.thumbnail = (e.images || {}).thumbnailUrl
      tmpObj.inventory = tmpObj.inventory || []
      const location = (e.location.detailed || [])[0]
      const inventory = {
        address: [
          e.store.name,
          e.store.streetAddress,
          `${e.store.city} ${e.store.stateProvCode} ${e.store.zip}`,
          e.store.phoneNumber,
          'distance uknown'
        ],
        price: parseFloat((e.price.priceInCents || 100) / 100),
        stock: e.inventory.quantity || 0,
        location: !location
          ? null : `${location.zone}-${location.aisle}-${location.section}`
      }
      tmpObj.inventory.push(inventory)
      model.forEach((k) => { tmpObj[k] = tmpObj[k] || e[k] })
    })
    tmpList = Object.keys(itemsObj).map((i) => itemsObj[i])
    let aryOut = []
    tmpList.forEach((e, i) => {
      const priceMap = (e.inventory || []).map((s) => s.price)
      e.maxPrice = Math.max(...priceMap)
      e.minPrice = Math.min(...priceMap)
      e.variancePercent = parseInt(100 - ((e.minPrice / e.maxPrice) * 100), 10)
      if (diff && (!isNumber(e.variancePercent) || e.variancePercent < diff)) {
        return null
      }
      e.inventory.sort((a, b) => a.price - b.price)
      aryOut[i] = {}
      model.forEach((k) => { aryOut[i][k] = e[k] })
    })
    aryOut = aryOut.filter((i) => i)
    aryOut.sort((a, b) => b.variancePercent - a.variancePercent)
    self.emit('store-query-done', aryOut)
  }
  let storesSearched = 0
  if (storesByZip[opts.zip]) storesProcessor(storesByZip[opts.zip], false)
  else self.wm.stores.byZip(opts.zip).then(storesProcessor).catch(handleErr)
  function storesProcessor (stores, setStores) {
    if (setStores !== false) storesByZip[opts.zip] = stores
    stores.forEach((s) => {
      let storeCount = 0
      let offset = 0
      function storeSearchCb (count, totalCount) {
        offset = offset + count
        storeCount = storeCount + count
        // totalCount = totalCount > 100 ? 100 : totalCount
        if (storeCount < totalCount) return storeSearch(s, offset, storeSearchCb)
        storesSearched = storesSearched + 1
        if (storesSearched === stores.length) return processThenPush()
      }
      storeSearch(s, offset, storeSearchCb)
    })
  }
  function storeSearch (s, offset, cb) {
    self.wm.stores.search(s.no, opts.query, { size: 50, offset }).then((data) => {
      data.results.forEach((r) => { r.store = s })
      tmpList = tmpList.concat(data.results)
      cb(data.count, data.totalCount)
    }).catch((e) => {
      handleErr(e)
      const z = 0
      cb(z, z)
    })
  }
  return self
}

// Search via Wlmart Open API then run results through BrickSeek for local info
WmPricer.prototype.brickseek = function (opts, cb) {
  const self = this
  const apiKeyErr = 'API key is required'
  if (!opts.apiKey) {
    cb ? cb(apiKeyErr) : console.error(apiKeyErr)
    return self
  }
  const zip = opts.zip || 33803
  const query = opts.query || '4k tv'
  const limit = opts.limit || 25
  const start = opts.start || 1
  const wm = wmApi(opts.apiKey)
  const out = []
  let listLength
  wm.search(query, { numItems: limit, start }).then((list) => {
    listLength = list.items.length
    list.items.forEach((item) => getBsHtml(item))
  }).catch(console.error)

  // get brickseek html
  function getBsHtml (item) {
    const reqBody = `zip=${zip}&item_id=${item.itemId}`
    const reqOpts = {
      hostname: 'brickseek.com',
      port: 80,
      path: `/walmart-inventory-checker?sku=${item.itemId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(reqBody)
      }
    }
    let body = ''
    const req = http.request(reqOpts, (res) => {
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => processBsResults(item, body))
    })
    req.on('error', (err) => cb ? cb(err) : console.error(err))
    req.write(reqBody)
    req.end()
  }

  // process results
  function processBsResults (wmItem, htmlText) {
    const $ = cheerio.load(htmlText)
    const rows = $('#main').find('.bsapi-inventory-checker-stores').find('tr')
    const item = {
      bsUrl: `http://brickseek.com/walmart-inventory-checker?sku=${wmItem.itemId}`
    }
    keepProps.forEach((k) => { item[k] = wmItem[k] })
    item.inventory = rows.map(function () {
      const addrHtml = $(this).find('.store-address').html() || ''
      const priceHtml = $(this).find('.store-price-number').html() || ''
      const stockHtml = $(this).find('.store-quan').html() || ''
      return {
        address: addrHtml.replace(/<(\/)?b>/g, '').split('<br>') || [],
        price: parseFloat(priceHtml.replace('$', '').trim()),
        stock: parseInt(((stockHtml.split('</b>:') || [])[1] || '').trim(), 10)
      }
    }).get().filter((i) => i.price)
    out.push(item)
    if (out.length === listLength) {
      cb ? cb(null, out) : console.log(out)
      return self
    }
  }
  return self
}
