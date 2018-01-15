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
  let self = this
  let noArgErr = 'Missing required argument (opts Object or apiKey String)'
  if (!opts) throw new Error(noArgErr)
  if (typeof opts === 'string') opts = {apiKey: opts}
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
  let self = this
  let handleErr = (err) => self.emit('error', err)
  opts = merge(opts || {}, self, true)
  let diff = opts.minDiff
  let tmpList = []
  let itemsObj = {}
  let processThenPush = () => {
    tmpList.forEach((e) => {
      if (!e.inventory || e.inventory.quantity < 1) return
      let id = (e.productId || {}).WWWItemId
      let tmpObj = itemsObj[id] = itemsObj[id] || {}
      tmpObj.itemId = id
      tmpObj.url = `http://www.walmart.com/ip/${id}`
      tmpObj.bsUrl = `http://brickseek.com/walmart-inventory-checker?sku=${id}`
      tmpObj.thumbnail = (e.images || {}).thumbnailUrl
      tmpObj.inventory = tmpObj.inventory || []
      let location = (e.location.detailed || [])[0]
      let inventory = {
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
      let priceMap = (e.inventory || []).map((s) => s.price)
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
    self.wm.stores.search(s.no, opts.query, {size: 50, offset}).then((data) => {
      data.results.forEach((r) => { r.store = s })
      tmpList = tmpList.concat(data.results)
      cb(data.count, data.totalCount)
    }).catch((e) => {
      handleErr(e)
      let z = 0
      cb(z, z)
    })
  }
  return self
}

// Search via Wlmart Open API then run results through BrickSeek for local info
WmPricer.prototype.brickseek = function (opts, cb) {
  let self = this
  let apiKeyErr = 'API key is required'
  if (!opts.apiKey) {
    cb ? cb(apiKeyErr) : console.error(apiKeyErr)
    return self
  }
  let zip = opts.zip || 33803
  let query = opts.query || '4k tv'
  let limit = opts.limit || 25
  let start = opts.start || 1
  let wm = wmApi(opts.apiKey)
  let out = []
  let listLength
  wm.search(query, {numItems: limit, start}).then((list) => {
    listLength = list.items.length
    list.items.forEach((item) => getBsHtml(item))
  }).catch(console.error)

  // get brickseek html
  function getBsHtml (item) {
    let reqBody = `zip=${zip}&item_id=${item.itemId}`
    let reqOpts = {
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
    let req = http.request(reqOpts, (res) => {
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
    let $ = cheerio.load(htmlText)
    let rows = $('#main').find('table').find('tr')
    let item = {
      bsUrl: `http://brickseek.com/walmart-inventory-checker?sku=${wmItem.itemId}`
    }
    keepProps.forEach((k) => { item[k] = wmItem[k] })
    item.inventory = rows.map(function () {
      let addrHtml = $(this).find('td').html() || ''
      let priceHtml = $(this).find('a').html() || ''
      let stockHtml = $(this).find('td').last().html() || ''
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
