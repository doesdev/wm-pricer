'use strict'

// Setup
const wmApi = require('walmart')
const open = require('open')

// get some stuff and things
module.exports = (apiKey, query, start) => {
  let wm = wmApi(apiKey)
  wm.search(query, {numItems: 25, start}).then((list) => {
    list.items.forEach((item) => {
      open(`http://brickseek.com/walmart-inventory-checker?sku=${item.itemId}`)
    })
  })
}
