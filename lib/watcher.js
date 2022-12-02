'use strict'

const chokidar = require('chokidar')
const { EventEmitter } = require('events')
const Tail = require('tail').Tail

class FilesWatcher extends EventEmitter {
  /**
   * @param {string} pathlike File path or glob pattern that will be tailed
   * @param {string} [encoding]
   * @param {object} other options
   */
  constructor (pathlike, encoding = 'utf-8', opts = {}) {
    super()

    this.opts = opts
    this.pathlike = pathlike
    this.encoding = encoding

    /** @type {Object<string, Tail>} */
    this.fileTails = {}
    /** @type {chokidar.FSWatcher | null} */
    this.watcher = null
    /** @type {boolean} */
    this.isReady = false
  }

  get files () {
    return Object.keys(this.fileTails)
  }

  static getFileDelimiter () {
    return ' >>> '
  }

  static parseLine (line) {
    const delimiter = FilesWatcher.getFileDelimiter()
    const [path, ...content] = line.split(delimiter)

    const hasPath = content.length

    return {
      path: hasPath ? path : null,
      content: hasPath ? content.join(delimiter) : line
    }
  }

  static formatLine (line, file = null) {
    const prefix = file ? file + FilesWatcher.getFileDelimiter() : ''

    return prefix + line
  }

  /**
   * @private
   * @param {String} file
   */
  async watchFile (file) {
    const tail = new Tail(file, {
      encoding: this.encoding
    })

    tail.on('line', (line) => {
      const data = FilesWatcher.formatLine(line, file)
      this.emit('data', data, file)
    })

    tail.watch()

    this.fileTails[file] = tail
  }

  /**
   * @private
   */
  async unwatchFile (file) {
    const watcher = this.fileTails[file]

    if (watcher) {
      watcher.unwatch()
      delete this.fileTails[file]
    }
  }

  async start () {
    this.watcher = chokidar.watch(this.pathlike, {
      usePolling: true,
      interval: 300
    })

    this.watcher.on('ready', () => {
      this.isReady = true
      this.emit('ready')
    })

    this.watcher.on('add', async file => {
      this.watchFile(file)
      this.emit('add', file)
    })

    this.watcher.on('unlink', file => {
      this.unwatchFile(file)
      this.emit('unlink', file)
    })
  }

  async stop () {
    Object.keys(this.fileTails).forEach(file => this.unwatchFile(file))
    if (this.watcher) this.watcher.close()
    this.isReady = false
  }
}

module.exports = FilesWatcher
