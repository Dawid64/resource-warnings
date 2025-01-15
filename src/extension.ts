import * as vscode from 'vscode'
import { getMacOsMemoryUsageInfo } from './darwin-memory'

export type FormatedVmStat = {
  total: number
  pageSize: number
  pagesActive: number
  pagesInactive: number
  pagesWiredDown: number
  pagesSpeculative: number
  pagesOccupiedByCompressor: number
  fileBackedPages: number
  pagesPurgeable: number
  [prop: string]: number
}

function rawToGB(raw: number) {
    return (raw / (1000 * 1000 * 1000)).toFixed(1)
}

let intervalHandle: NodeJS.Timeout | undefined

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBarItem.text = '$(database) ... GB'
  statusBarItem.tooltip = 'Memory Usage'
  statusBarItem.color = '#FFFFFF'
  statusBarItem.show()

  intervalHandle = setInterval(async () => {
    const info = await getMacOsMemoryUsageInfo()
    const usagePercent = info.usagePercent * 100 * 1.024 * 1.024 * 1.024
    statusBarItem.text = `$(database) ${rawToGB(info.used)} GB`

    if (usagePercent >= 80) {
      statusBarItem.color = '#FF0000'
    } else {
      statusBarItem.color = '#FFFFFF'
    }
  }, 5000)

  context.subscriptions.push(statusBarItem)
  context.subscriptions.push({
    dispose: () => {
      if (intervalHandle) clearInterval(intervalHandle)
    }
  })
}
