import { Router } from '../router'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

export function createRoute(
  record: Router.RouteRecord | undefined,
  location: Router.Location,
  redirectedFrom?: Router.Location,
  router?: Router,
): Router.Route {
  const stringifyQuery = router && router.options.stringifyQuery

  let query: any = location.query || {}
  try {
    query = clone(query)
  } catch (e) { }

  const route: Router.Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : [],
  }
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  return Object.freeze(route)
}

function clone<O extends any = any>(value: O): O {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res: Router.Dictionary<any> = {}
    Object.keys(value).forEach((key) => {

      res[key] = clone(value[key])
    })
    return res as O
  } else {
    return value
  }
}

// the starting route that represents the initial state
export const START = createRoute(void 0, { path: '/' })

function formatMatch(record?: Router.RouteRecord): Router.RouteRecord[] {
  const res = []
  while (record) {
    res.unshift(record)
    record = record.parent
  }
  return res
}

function getFullPath(
  { path, query = {}, hash = '' }: Router.Route | Router.Location,
  _stringifyQuery?: (obj: Router.query) => string,
): string {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

export function isSameRoute(a: Router.Route, b?: Router.Route): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    return (
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else {
    return false
  }
}

function isObjectEqual(a: Router.Dictionary<any> = {}, b: Router.Dictionary<any> = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every((key) => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute(current: Router.Route, target: Router.Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/'),
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes(current: Router.query, target: Router.query): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}