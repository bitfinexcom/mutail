const argv = require('minimist')(process.argv.slice(2))
const FilesWatcher = require('./lib/watcher')

const helpMsg = 'Usage:\nmutail -f file(s)'

if (argv.help) {
  console.log(helpMsg)
  process.exit(-1)
}

const conf = {}

if (!argv.f) {
  console.error('Error: file/pattern invalid')
  process.exit(-1)
}

let lout = null

if (argv.net) {
  conf.net = true
  conf.port = argv.port || 15556

  const Out = require('./lib/out_net')

  lout = new Out({ port: conf.port })
  lout.start()
} else {
  lout = new (require('./lib/out_std'))()
  lout.start()
}

const watcher = new FilesWatcher(argv.f, 'utf-8', {
  watchPollInterval: +argv.poll || 250
})

watcher.on('data', data => {
  lout.push(data)
})

process.once('SIGINT', () => {
  watcher.stop()
})

watcher.start()
