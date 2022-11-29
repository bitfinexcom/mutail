'use strict'

const fs = require('fs')
const chokidar = require('chokidar')
const readline = require('readline')
const { EventEmitter } = require('events')
const Tail = require('tail').Tail

const isGlob = (pathlike) => /\*|\?|\^|!|\+|@|\[|\]/.test(pathlike)

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
    this.multiple = isGlob(this.pathlike)

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
   * @param {String} file
   */
  readFile (file) {
    const { multiple } = this
    const rstream = fs.createReadStream(file, { encoding: this.encoding })
    const rl = readline.createInterface({
      input: rstream,
      crlfDelay: Infinity
    })

    return {
      [Symbol.asyncIterator]: async function * () {
        for await (const line of rl) {
          yield FilesWatcher.formatLine(line, multiple && file)
        }
      }
    }
  }

  /**
   * @private
   * @param {String} file
   */
  async watchFile (file) {
    if (this.isReady) {
      for await (const line of this.readFile(file)) {
        this.emit('data', line, file) // republish new files
      }
    }
    const tail = new Tail(file, { encoding: this.encoding })
    tail.on('line', (line) => {
      const data = FilesWatcher.formatLine(line, this.multiple && file)
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

  /**
   * Fetch all the data, then watch tail
   * @param {Function} listener
   */
  async fetch (listener) {
    const published = new Set([])

    this.on('data', (data, file) => {
      if (published.has(file)) {
        listener(data)
      }
    })
    await Promise.all(this.files.map(async file => {
      for await (const line of this.readFile(file)) {
        listener(line)
      }
      published.add(file)
    }))
    this.on('add', async (file) => {
      for await (const line of this.readFile(file)) {
        listener(line)
      }
      published.add(file)
    })
    this.on('unlink', file => {
      published.delete(file)
    })
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
