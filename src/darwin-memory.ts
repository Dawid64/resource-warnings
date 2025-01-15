import { execSync } from 'child_process';
import * as os from 'os';
import { FormatedVmStat } from './extension';


function getFormatedVmStat(): FormatedVmStat {
  const rawVmStat = execSync('vm_stat').toString()
  const data: FormatedVmStat = {
    total: os.totalmem(),
    pageSize: 4096,
    pagesActive: 0,
    pagesInactive: 0,
    pagesWiredDown: 0,
    pagesSpeculative: 0,
    pagesOccupiedByCompressor: 0,
    fileBackedPages: 0,
    pagesPurgeable: 0
  }
  rawVmStat.split('\n').forEach((line, index) => {
    if (index === 0) {
      const pageSize = /page\ssize\sof\s(\d*)\sbytes/i.exec(line)?.[1]
      if (pageSize) data.pageSize = parseInt(pageSize)
    } else {
      const [rawKey, rawValue] = line.split(':')
      if (rawKey && rawValue) {
        const key = rawKey
          .trim()
          .toLowerCase()
          .replace(/"/g, '')
          .replace(/(_|-)/g, ' ')
          .split(' ')
          .map((word, i) => `${i === 0 ? word[0] : word.charAt(0).toUpperCase()}${word.slice(1)}`)
          .join('')
        const value = rawValue.trim().replace(/\./g, '')
        data[key] = parseInt(value)
      }
    }
  })
  return data
}
type MacOsMemoryUsageInfo = {
  total: number
  used: number
  free: number
  active: number
  inactive: number
  wired: number
  compressed: number
  app: number
  cache: number
  vmStat: FormatedVmStat
  pressurePercent: number
  usagePercent: number
}

export function getMacOsMemoryUsageInfo() {
  return new Promise<MacOsMemoryUsageInfo>((resolve, reject) => {
    process.nextTick(() => {
      try {
        const vmStat = getFormatedVmStat()
        const active = vmStat.pagesActive * vmStat.pageSize
        const inactive = vmStat.pagesInactive * vmStat.pageSize
        const speculative = vmStat.pagesSpeculative * vmStat.pageSize
        const wired = vmStat.pagesWiredDown * vmStat.pageSize
        const compressed = vmStat.pagesOccupiedByCompressor * vmStat.pageSize
        const fileBacked = vmStat.fileBackedPages * vmStat.pageSize
        const purgeable = vmStat.pagesPurgeable * vmStat.pageSize
        const used = active + inactive + speculative + wired + compressed - purgeable - fileBacked
        const free = vmStat.total - used
        const app = used - wired - compressed
        const cache = purgeable + fileBacked
        const pressurePercent = (wired + compressed) / vmStat.total
        const usagePercent = used / vmStat.total
        resolve({
          total: vmStat.total,
          used,
          free,
          active,
          inactive,
          wired,
          compressed,
          app,
          cache,
          vmStat,
          pressurePercent,
          usagePercent
        })
      } catch (err) {
        reject(err)
      }
    })
  })
}
