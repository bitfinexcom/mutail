const net = require('net')

class Out {
  constructor (opts = {}) {
    this.opts = opts
  }

  start () {
    this.reconnect()
  }

  stop () {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }

    this.stopped = true
  }

  push (data) {
    if (!this.connnected) {
      return
    }

    data = typeof data === "string" ? data + "\n" : data
    this.client.write(data)
  }

  reconnect () {
    if (this.stopped) {
      return    
    }

    if (this.reconnecting) {
      return
    }

    this.reconnecting = true
    this.connnected = false

    this.client = new net.Socket()

    this.client.connect(this.opts.port, this.opts.ip, () => {
      this.reconnecting = false
      this.connnected = true
	    console.log('connected')
    })
 
    this.client.on('error', () => {
	    console.log('error')
       destroy()
    }).on('close', () => {
	    console.log('closed')
       destroy()
    })

    const destroy = () => {
      if (this.client) {
        this.client.destroy()
        this.client = null
      }

      this.connnected = false
      this.reconnecting = false

      setTimeout(() => {
        this.reconnect()
      }, 1000)
    }
  }
}

module.exports = Out
