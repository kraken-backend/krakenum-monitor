import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { execSync } from 'child_process'
import * as path from 'path'
import * as net from 'net'

type S = 'stopped' | 'starting' | 'running' | 'error'

interface ServiceInfo { name: string; status: S; port: number; url: string; log: string[] }

const services: ServiceInfo[] = [
  { name: 'Rust Node', status: 'stopped', port: 8088, url: '/gateway/status?mode=api', log: [] },
  { name: 'Go Gateway', status: 'stopped', port: 8090, url: '/gateway/status?mode=api', log: [] },
  { name: 'Wallet BE', status: 'stopped', port: 8098, url: '/api/health', log: [] },
]

let mainWindow: BrowserWindow | null = null
let serviceProcs: (ChildProcess | null)[] = [null, null, null]

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1100, height: 800, title: 'Krakenum Monitor', webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } })
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
}

function log(i: number, msg: string) {
  const t = new Date().toLocaleTimeString()
  services[i].log.push(`[${t}] ${msg.slice(0, 300)}`)
  if (services[i].log.length > 200) services[i].log.shift()
  send()
}

function logAll(msg: string) {
  const t = new Date().toLocaleTimeString()
  const line = `[${t}] ${msg.slice(0, 300)}`
  for (let i = 0; i < services.length; i++) { services[i].log.push(line); if (services[i].log.length > 200) services[i].log.shift() }
  if (mainWindow && !mainWindow.isDestroyed()) send()
}

function send() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('status-update', services.map((s, i) => ({ name: s.name, status: s.status, port: s.port, logs: s.log.slice(-50) })))
}

async function verify(i: number): Promise<boolean> {
  return new Promise(r => {
    const c = net.createConnection(services[i].port, '127.0.0.1')
    c.setTimeout(3000)
    c.on('connect', () => { c.destroy(); r(true) })
    c.on('timeout', () => { c.destroy(); r(false) })
    c.on('error', () => r(false))
  })
}

async function killPorts() {
  logAll('Kill ports...')
  const ps = [8088, 8090, 8098]
  for (let pi = 0; pi < ps.length; pi++) {
    try {
      const out = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${ps[pi]} -EA SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`, { encoding: 'utf8', windowsHide: true })
      for (let li = 0; li < out.split('\n').length; li++) {
        const pid = parseInt(out.split('\n')[li].trim())
        if (pid > 0) try { execSync(`taskkill /F /PID ${pid}`, { windowsHide: true }) } catch {}
      }
    } catch {}
  }
}

async function checkAll() {
  for (let i = 0; i < services.length; i++) {
    if (services[i].status === 'stopped') continue
    services[i].status = await verify(i) ? 'running' : 'error'
  }
  send()
}

async function startAll() {
  logAll('=== START ===')
  await killPorts()
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const dirs = ['D:/upwork/KVP/Codes/MainKVP2026/backend-rust-node', 'D:/upwork/KVP/Codes/MainKVP2026/backend-go-gateway', 'D:/upwork/KVP/Codes/WalletKVP2026/backend-go']
  const cmds = [['cargo', 'run'], ['go', 'run', '.'], ['go', 'run', '.']]
  const envs = [undefined, undefined, { ...process.env, PORT: '8098', KVC_API_BASE: 'http://localhost:8090' }]
  
  for (let i = 0; i < 3; i++) {
    services[i].status = 'starting'
    services[i].log = []
    log(i, 'Starting...')
    serviceProcs[i] = spawn(cmds[i][0], cmds[i].slice(1), { cwd: dirs[i], shell: true, env: envs[i] })
    serviceProcs[i].stdout?.on('data', d => log(i, d.toString()))
    serviceProcs[i].stderr?.on('data', d => log(i, d.toString()))
    serviceProcs[i].on('close', code => { services[i].status = code === 0 ? 'stopped' : 'error'; serviceProcs[i] = null; checkAll() })
    serviceProcs[i].on('error', err => { services[i].status = 'error'; log(i, err.message); serviceProcs[i] = null; checkAll() })
    await new Promise(resolve => setTimeout(resolve, 2500))
  }
  
  logAll('Waiting services...')
  for (let w = 0; w < 8; w++) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    let ok = true
    for (let i = 0; i < 3; i++) { if (services[i].status !== 'running') services[i].status = await verify(i) ? 'running' : 'starting'; ok = ok && services[i].status === 'running' }
    send()
    if (ok) break
  }
  
logAll('Starting tunnels + Vercel deploy...')
  const script = 'D:/upwork/KVP/Codes/start_tunnels_and_deploy.ps1'
  const proc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', script], { cwd: 'D:/upwork/KVP/Codes', shell: true })
  proc.stdout?.on('data', d => logAll('Tunnel: ' + d.toString().slice(0, 200)))
  proc.stderr?.on('data', d => logAll('Tunnel error: ' + d.toString().slice(0, 200)))
  
  logAll('Waiting for Vercel deployment (~45s)...')
  await new Promise(resolve => setTimeout(resolve, 45000))
  
  logAll('Verifying Vercel deployment...')
  const vercelToken = process.env.VERCEL_TOKEN
  const blockchainProj = process.env.VERCEL_BLOCKCHAIN_PROJ
  const walletProj = process.env.VERCEL_WALLET_PROJ
  
  if (!vercelToken || !blockchainProj || !walletProj) {
    logAll('=== MISSING ENV: VERCEL_TOKEN, VERCEL_BLOCKCHAIN_PROJ, VERCEL_WALLET_PROJ ===')
    return
  }
  
  const checkVercel = async (projId: string): Promise<string> => {
    try {
      const out = execSync(`curl -s "https://api.vercel.com/v6/deployments?projectId=${projId}&limit=1" -H "Authorization: Bearer ${vercelToken}"`, { encoding: 'utf8', windowsHide: true })
      const json = JSON.parse(out)
      return json.deployments?.[0]?.state || 'UNKNOWN'
    } catch { return 'ERROR' }
  }
  
  for (let poll = 0; poll < 6; poll++) {
    const bcState = await checkVercel(blockchainProj)
    const walletState = await checkVercel(walletProj)
    logAll(`Poll ${poll + 1}: Blockchain=${bcState}, Wallet=${walletState}`)
    
    if (bcState === 'READY' && walletState === 'READY') {
      logAll('=== ALL READY ===')
      break
    }
    if (bcState === 'ERROR' || walletState === 'ERROR' || bcState === 'FAILED' || walletState === 'FAILED') {
      logAll('=== DEPLOYMENT FAILED ===')
      break
    }
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  const finalBc = await checkVercel(blockchainProj)
  const finalWallet = await checkVercel(walletProj)
  if (finalBc !== 'READY' || finalWallet !== 'READY') {
    logAll('=== DEPLOYMENT CHECK COMPLETE - CHECK MANUALLY IF NOT READY ===')
  }
}

async function stopAll() {
  logAll('=== STOP ===')
  for (let i = 0; i < 3; i++) { if (serviceProcs[i]) { try { serviceProcs[i]!.kill() } catch {} serviceProcs[i] = null }; services[i].status = 'stopped' }
  await killPorts()
  logAll('=== STOPPED ===')
  checkAll()
}

ipcMain.handle('get-status', () => services.map((s, i) => ({ name: s.name, status: s.status, port: s.port, logs: s.log.slice(-50) })))
ipcMain.on('start-all', () => startAll())
ipcMain.on('stop-all', () => stopAll())

app.whenReady().then(() => { createWindow(); setInterval(checkAll, 5000) })
app.on('window-all-closed', () => { stopAll(); app.quit() })