import _ from 'lodash'
import sift from 'sift'
import { when } from 'feathers-hooks-common'
import makeDebug from 'debug'
// Built-in hooks
export * from './hooks.auth'
export * from './hooks.clear'
export * from './hooks.csv'
export * from './hooks.grid'
export * from './hooks.json'
export * from './hooks.ogc'
export * from './hooks.pg'
export * from './hooks.raster'
export * from './hooks.store'
export * from './hooks.xml'
export * from './hooks.yaml'

const debug = makeDebug('krawler:hooks')
// Custom hooks
let hooks = {}

export function registerHook (hookName, hookFunction) {
  hooks[hookName] = hookFunction
}

export function unregisterHook (hookName) {
  delete hooks[hookName]
}

export function getHook (hookName) {
  return hooks[hookName]
}

export function parallel (hooks) {
  return async function (hookObject) {
    return Promise.all(hooks.map(hook => hook(hookObject))).then(_ => hookObject)
  }
}

export function getHookFunction (hookName) {
  // Jump from name to the real hook function
  // First built-in hooks
  let hook = hooks[hookName]
  // Then custom ones
  if (!hook) hook = getHook(hookName)
  if (typeof hook !== 'function') {
    let message = 'Unknown hook ' + hookName
    debug(message)
    throw new Error(message)
  }
  return hook
}

// Generate a predicate to be used in a when/iff clause
// that will skip the associated hook depending on configured properties
export function match (hookName, filter) {
  return function (hook) {
    // Check if the hook has to be executed or not depending on its propeties
    const execute = !_.isEmpty(sift(filter, [hook.data]))
    if (execute) debug('Skipping hook ' + hookName + ' due to filter', filter)
    else debug('Executing hook ' + hookName + ' not filtered by', filter)
    return execute
  }
}

export function activateHooks (serviceHooks, service) {
  // Iterate over hook types (before, after)
  _.forOwn(serviceHooks, (hooksDefinition, stage) => {
    // Iterate over hooks to create the hook pipeline
    let pipeline = []
    _.forOwn(hooksDefinition, (hookOptions, hookName) => {
      // Check for parallel execution hook
      if (hookName === 'parallel') {
        try {
          // In this case we have an array of hooks to be run in parallel
          // Each item contains the hook name as a 'hook' property and hook options
          let hooks = hookOptions.map(item => {
            // Jump from name/options to the real hook function
            let hook = getHookFunction(item.hook)
            const filter = item.match
            if (filter) debug('Adding hook ' + hookName + ' to hook chain with filter', filter)
            else debug('Adding hook ' + hookName + ' to hook chain')
            // Check if this hook has filtering options
            return (filter ? when(match(hookName, filter), hook(item)) : hook(item))
          })
          pipeline.push(parallel(hooks))
        } catch (error) {
          console.error(error.message)
        }
      } else {
        // Jump from name/options to the real hook function
        let hook
        try {
          // If hook name is given as 'hook' option property use it
          // otherwise us key as hook name
          hookName = _.get(hookOptions, 'hook', hookName)
          hook = getHookFunction(hookName)
          const filter = hookOptions.match
          if (filter) debug('Adding hook ' + hookName + ' to hook chain with filter', filter)
          else debug('Adding hook ' + hookName + ' to hook chain')
          // Check if this hook has filtering options
          hook = (filter ? when(match(hookName, filter), hook(hookOptions)) : hook(hookOptions))
          pipeline.push(hook)
        } catch (error) {
          console.error(error.message)
        }
      }
    })
    // Replace hooks in place so that we can use it directly with Feathers after
    serviceHooks[stage] = { create: pipeline } // We only have create operation to manage
  })
  // Setup hooks on service
  if (service) service.hooks(serviceHooks)
}
