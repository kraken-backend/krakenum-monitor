import { contextBridge, ipcRenderer } from 'electron'

interface ServiceStatus {
  name: string
  running: boolean
  port: number
  logs: string[]
}

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  start: (idx: number) => ipcRenderer.send('start', idx),
  stop: (idx: number) => ipcRenderer.send('stop', idx),
  startAll: () => ipcRenderer.send('start-all'),
  stopAll: () => ipcRenderer.send('stop-all'),
  onStatusUpdate: (cb: (services: ServiceStatus[]) => void) => {
    ipcRenderer.on('status-update', (_, services) => cb(services))
  }
})