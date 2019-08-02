'use strict'

const test = require('mvt')
const secrets = require('./secrets.json')
const WmPricer = require('./index')
const WmPricerApi = WmPricer.api

test('storeQuery returns expected data', async (assert) => {
  const data = await new Promise((resolve, reject) => {
    const wmp = WmPricerApi.new(secrets.apiKey)
    wmp.on('error', reject)
    wmp.once('store-query-done', resolve)
    wmp.storeQuery({ zip: 33803, query: 'tv', minDiff: 0 })
  })
  assert.true(Array.isArray(data))
  assert.true(data[0].inventory.length > 0)
  assert.truthy(data[0].bsUrl && data[0].itemId && data[0].name)
})

test.failing('brickseek returns expected data', async (assert) => {
  const data = await new Promise((resolve, reject) => {
    const wmp = WmPricerApi.new(secrets.apiKey)
    const opts = { apiKey: secrets.apiKey, zip: 33803, query: 'tv', minDiff: 0 }
    wmp.brickseek(opts, (err, data) => err ? reject(err) : resolve(data))
  })
  assert.true(Array.isArray(data))
  assert.true(data[0].inventory.length > 0)
  assert.truthy(data[0].bsUrl && data[0].itemId && data[0].name)
})
