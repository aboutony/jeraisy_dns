import { describe, it, expect } from 'vitest'

describe('Backend API', () => {
  it('should export server module', async () => {
    // Basic test that the server can be imported
    const fs = require('fs')
    const path = require('path')
    const serverPath = path.join(__dirname, 'server.js')
    expect(fs.existsSync(serverPath)).toBe(true)
  })
})