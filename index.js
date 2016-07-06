'use strict'

// Setup
const wmApi = require('walmart')
const http = require('http')
const cheerio = require('cheerio')
const keepProps = ['itemId', 'name', 'msrp', 'salePrice', 'modelNumber', 'upc']

// get some stuff and things
module.exports = (apiKey, zip, query, start, cb) => {
  let wm = wmApi(apiKey)
  let out = []
  let listLength
  wm.search(query, {numItems: 5, start}).then((list) => {
    listLength = list.items.length
    list.items.forEach((item) => getBsHtml(item))
  })

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
      res.on('data', (chunk) => body += chunk)
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
    keepProps.forEach((k) => item[k] = wmItem[k])
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
    if (out.length === listLength) return cb ? cb(null, out) : console.log(out)
  }
}
