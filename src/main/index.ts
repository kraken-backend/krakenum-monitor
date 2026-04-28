import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { execSync } from 'child_process'
import * as path from 'path'
import * as net from 'net'
import * as fs from 'fs'

const envPath = path.join(__dirname, '../../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  }
}

type S = 'stopped' | 'starting' | 'running' | 'error'

interface ServiceInfo { name: string; status: S; port: number; url: string; log: string[] }

let allReady = false

const services: ServiceInfo[] = [
  { name: 'Startup', status: 'stopped', port: 0, url: '', log: [] },
  { name: 'Rust Node', status: 'stopped', port: 8088, url: '/gateway/status?mode=api', log: [] },
  { name: 'Go Gateway', status: 'stopped', port: 8090, url: '/gateway/status?mode=api', log: [] },
  { name: 'Wallet BE', status: 'stopped', port: 8098, url: '/api/health', log: [] },
]

let mainWindow: BrowserWindow | null = null
let serviceProcs: (ChildProcess | null)[] = [null, null, null]
let checkInterval: NodeJS.Timeout | null = null

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

function logAll(msg: string) { log(0, msg) }

function send() {
  const data = { services: services.map((s, i) => ({ name: s.name, status: s.status, port: s.port, logs: s.log.slice(-50) })), allReady }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('status-update', data)
}

async function verify(i: number): Promise<boolean> {
  const port = services[i].port
  if (!port) return true
  return new Promise(r => {
    const c = net.createConnection(port, '127.0.0.1')
    c.setTimeout(3000)
    c.on('connect', () => { c.destroy(); r(true) })
    c.on('timeout', () => { c.destroy(); r(false) })
    c.on('error', () => r(false))
  })
}

async function killPorts() {
  log(0, 'Kill ports...')
  const ps = [8088, 8090, 8098]
  for (let pi = 0; pi < ps.length; pi++) {
    try {
      const out = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${ps[pi]} -EA SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`, { encoding: 'utf8', windowsHide: true })
      for (const line of out.split('\n')) {
        const pid = parseInt(line.trim())
        if (pid > 0) {
          try { execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8', windowsHide: true }) } catch {}
        }
      }
    } catch {}
  }
}

async function checkAll() {
  for (let i = 1; i <= 3; i++) {
    if (services[i].status === 'stopped') continue
    services[i].status = await verify(i) ? 'running' : 'error'
  }
  send()
}

async function startAll() {
  logAll('=== START ===')
  log(0, '=== START ALL ===')
  await killPorts()
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  log(0, 'Starting backend services...')
  const dirs = ['D:/upwork/KVP/Codes/MainKVP2026/backend-rust-node', 'D:/upwork/KVP/Codes/MainKVP2026/backend-go-gateway', 'D:/upwork/KVP/Codes/WalletKVP2026/backend-go']
  const cmds = [['cargo', 'run'], ['go', 'run', '.'], ['go', 'run', '.']]
  const envs = [undefined, undefined, { ...process.env, PORT: '8098', KVC_API_BASE: 'http://localhost:8090' }]
  
  for (let i = 1; i <= 3; i++) {
    const idx = i
    services[idx].status = 'starting'
    services[idx].log = []
    log(idx, 'Starting...')
    serviceProcs[idx-1] = spawn(cmds[i-1][0], cmds[i-1].slice(1), { cwd: dirs[i-1], shell: true, env: envs[i-1] })
    serviceProcs[idx-1]?.stdout?.on('data', d => log(idx, d.toString()))
    serviceProcs[idx-1]?.stderr?.on('data', d => log(idx, d.toString()))
    serviceProcs[idx-1]?.on('close', code => { services[idx].status = code === 0 ? 'stopped' : 'error'; serviceProcs[idx-1] = null; checkAll() })
    serviceProcs[idx-1]?.on('error', err => { services[idx].status = 'error'; log(idx, err.message); serviceProcs[idx-1] = null; checkAll() })
    await new Promise(resolve => setTimeout(resolve, 2500))
  }
  
log(0, 'Waiting services...')
  for (let w = 0; w < 8; w++) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    let ok = true
    for (let i = 1; i <= 3; i++) { if (services[i].status !== 'running') services[i].status = await verify(i) ? 'running' : 'starting'; ok = ok && services[i].status === 'running' }
    send()
    if (ok) break
  }
  
  log(0, 'Starting tunnels + Vercel deploy...')
  const script = 'D:/upwork/KVP/Codes/start_tunnels_and_deploy.ps1'
  const proc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', script], { cwd: 'D:/upwork/KVP/Codes', shell: true })
  proc.stdout?.on('data', d => logAll('Tunnel: ' + d.toString().slice(0, 200)))
  proc.stderr?.on('data', d => log(0, 'Tunnel error: ' + d.toString().slice(0, 200)))
  
  log(0, 'Waiting for Vercel deployment (~45s)...')
  await new Promise(resolve => setTimeout(resolve, 45000))
  
  log(0, 'Verifying Vercel deployment...')
  const vercelToken = process.env.VERCEL_TOKEN
  const blockchainProj = process.env.VERCEL_BLOCKCHAIN_PROJ
  const walletProj = process.env.VERCEL_WALLET_PROJ
  
  if (!vercelToken || !blockchainProj || !walletProj) {
    log(0, '=== MISSING ENV: VERCEL_TOKEN, VERCEL_BLOCKCHAIN_PROJ, VERCEL_WALLET_PROJ ===')
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
      allReady = true
      logAll('=== ALL READY ===')
      send()
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
  log(0, '=== STOP ===')
  allReady = false
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null }
  log(0, 'Killing processes by port (2x)...')
  await killPorts()
  await new Promise(resolve => setTimeout(resolve, 1500))
  await killPorts()
  await new Promise(resolve => setTimeout(resolve, 2000))
  for (let i = 1; i <= 3; i++) {
    serviceProcs[i-1] = null
    services[i].status = 'stopped'
  }
  log(0, '=== STOPPED ===')
  send()
}

ipcMain.handle('get-status', () => ({ services: services.map((s, i) => ({ name: s.name, status: s.status, port: s.port, logs: s.log.slice(-50) })), allReady }))
ipcMain.on('start-all', () => startAll())
ipcMain.on('stop-all', () => stopAll())

app.whenReady().then(() => { createWindow(); checkInterval = setInterval(checkAll, 5000) })
app.on('window-all-closed', () => { stopAll(); if (checkInterval) clearInterval(checkInterval); app.quit() })