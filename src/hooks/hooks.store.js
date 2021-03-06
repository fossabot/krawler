import _ from 'lodash'
import makeDebug from 'debug'

const debug = makeDebug('krawler:hooks:store')

// Create a new (set of) store(s)
export function createStores (options = {}) {
  return async function (hook) {
    if (hook.type !== 'before') {
      throw new Error(`The 'createStore' hook should only be used as a 'before' hook.`)
    }

    // Transform to array
    if (!Array.isArray(options)) options = [options]

    for (let i = 0; i < options.length; i++) {
      const storeOptions = options[i]
      debug('Creating store for ' + hook.data.id + ' with options ', storeOptions)
      let store
      try {
        // Check if store does not already exist
        store = await hook.service.storesService.get(storeOptions.id)
      } catch (error) {
        store = await hook.service.storesService.create(storeOptions)
      }
      if (storeOptions.storePath) _.set(hook.data, storeOptions.storePath, store)
    }

    return hook
  }
}

// Remove an existing (set of) store(s)
export function removeStores (options = {}) {
  return async function (hook) {
    if (hook.type !== 'after') {
      throw new Error(`The 'removeStore' hook should only be used as a 'after' hook.`)
    }

    // Transform to array
    if (!Array.isArray(options)) options = [options]

    for (let i = 0; i < options.length; i++) {
      const storeOptions = options[i]
      const id = (typeof storeOptions === 'string' ? storeOptions : storeOptions.id)
      debug('Removing store ' + id + ' for ' + hook.data.id)
      await hook.service.storesService.remove(id)
      if (storeOptions.storePath) _.unset(hook.data, storeOptions.storePath)
    }

    return hook
  }
}
