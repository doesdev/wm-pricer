// Setup
const WmPricer = require('./lib/wm-pricer')

// Export
module.exports = (opts, cb) => {
  const wmPricer = WmPricer.new(opts)
  wmPricer.brickseek(opts, cb)
}
module.exports.api = WmPricer
