import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import feathers from 'feathers'
import plugin from '../src'

describe('krawler', () => {
  let app

  before(() => {
    chailint(chai, util)
    app = feathers()
  })

  it('is CommonJS compatible', () => {
    expect(typeof plugin).to.equal('function')
    expect(typeof plugin.stores).to.equal('function')
    expect(typeof plugin.stores.Service).to.equal('function')
    expect(typeof plugin.tasks).to.equal('function')
    expect(typeof plugin.tasks.Service).to.equal('function')
    expect(typeof plugin.jobs).to.equal('function')
    expect(typeof plugin.jobs.Service).to.equal('function')
  })

  it('registers the plugin', () => {
    app.configure(plugin)
  })
})
