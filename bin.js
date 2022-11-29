const argv = require('minimist')(process.argv.slice(2))
const FilesWatcher = require('./lib/watcher')

const helpMsg = 'Usage:\nmutail -f file(s)'

if (argv.help) {
  console.log(helpMsg)
  process.exit(-1)
}

if (!argv.f) {
  console.error('Error: file/pattern invalid')
  process.exit(-1)
}

const watcher = new FilesWatcher(argv.f, 'utf-8', {
})

watcher.on('data', data => {
  console.log(data)
})

process.once('SIGINT', () => {
  watcher.stop()
})

watcher.start()
