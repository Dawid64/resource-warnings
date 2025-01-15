import * as vscode from 'vscode'
import * as os from 'os'
import { exec } from 'child_process'

let previousColorCustomizations: any
let intervalHandle: NodeJS.Timeout | undefined

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBarItem.text = 'RAM: ...'
  statusBarItem.show()

  intervalHandle = setInterval(async () => {
    const { used, total, pressure } = await readMacMemoryInfo()
    const usagePct = (used / total) * 100
    statusBarItem.text = `RAM: ${usagePct.toFixed(2)}% | Pressure: ${pressure.toFixed(0)}%`
    if (usagePct >= 85) {
      statusBarItem.color = '#FF0000'
      setStatusBarBackground('#FF0000')
    } else {
      statusBarItem.color = '#999999'
      restoreStatusBarBackground()
    }
  }, 5000)

  context.subscriptions.push(statusBarItem)
  context.subscriptions.push({
    dispose: () => {
      if (intervalHandle) clearInterval(intervalHandle)
    },
  })
}

export function deactivate() {
  restoreStatusBarBackground()
}

function readMacMemoryInfo(): Promise<{ used: number; total: number; pressure: number }> {
  return new Promise((resolve) => {
    exec('vm_stat', async (err, stdout) => {
      if (err) {
        resolve({ used: 0, total: os.totalmem(), pressure: await readMemoryPressure() })
      } else {
        const lines = stdout.trim().split('\n')
        const pageSize = 4096
        let free = 0
        let active = 0
        let speculative = 0
        let wired = 0
        let compressed = 0
        for (const line of lines) {
          const parts = line.split(':')
          if (parts.length !== 2) continue
          const key = parts[0].trim()
          const val = parseInt(parts[1]) * pageSize
          if (key === 'Pages free') free = val
          if (key === 'Pages active') active = val
          if (key === 'Pages speculative') speculative = val
          if (key === 'Pages wired down') wired = val
          if (key === 'Pages occupied by compressor') compressed = val
        }
        const total = os.totalmem()
        const used = active + wired + compressed
        const pressure = await readMemoryPressure()
        resolve({ used, total, pressure })
      }
    })
  })
}

function readMemoryPressure(): Promise<number> {
  return new Promise((resolve) => {
    exec('memory_pressure | grep "System-wide memory free percentage"', (err, stdout) => {
      if (err) {
        resolve(0)
      } else {
        const match = stdout.match(/(\d+)%$/)
        if (match) {
          const freePct = parseInt(match[1], 10)
          resolve(100 - freePct)
        } else {
          resolve(0)
        }
      }
    })
  })
}

function setStatusBarBackground(color: string) {
  const config = vscode.workspace.getConfiguration()
  const current = config.get('workbench.colorCustomizations') || {}
  if (!previousColorCustomizations) previousColorCustomizations = current
  const updated = {
    ...current,
    'statusBar.background': color,
    'statusBar.noFolderBackground': color,
    'statusBar.debuggingBackground': color
  }
  config.update('workbench.colorCustomizations', updated, vscode.ConfigurationTarget.Global)
}

function restoreStatusBarBackground() {
  if (!previousColorCustomizations) return
  const config = vscode.workspace.getConfiguration()
  config.update('workbench.colorCustomizations', previousColorCustomizations, vscode.ConfigurationTarget.Global)
  previousColorCustomizations = undefined
}