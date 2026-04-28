import { useState, useEffect } from 'react'

type ServiceStatus = 'stopped' | 'starting' | 'running' | 'error'

interface ServiceInfo {
  name: string
  status: ServiceStatus
  port: number
  logs: string[]
}

const defaultServices: ServiceInfo[] = [
  { name: 'Rust Node', status: 'stopped', port: 8088, logs: [] },
  { name: 'Go Gateway', status: 'stopped', port: 8090, logs: [] },
  { name: 'Wallet BE', status: 'stopped', port: 8098, logs: [] },
]

declare global {
  interface Window {
    api: {
      getStatus: () => Promise<ServiceInfo[]>
      startAll: () => void
      stopAll: () => void
      onStatusUpdate: (cb: (services: ServiceInfo[]) => void) => void
    }
  }
}

export default function App() {
  const [services, setServices] = useState<ServiceInfo[]>(defaultServices)
  const [selected, setSelected] = useState(0)
  const [lastCheck, setLastCheck] = useState('')

  useEffect(() => {
    window.api.getStatus().then(setServices)
    window.api.onStatusUpdate((updated) => {
      setServices(updated)
      setLastCheck(new Date().toLocaleTimeString())
    })
  }, [])

  const startAll = () => window.api.startAll()
  const stopAll = () => window.api.stopAll()

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'running': return '#10b981'
      case 'starting': return '#f59e0b'
      case 'error': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getStatusText = (status: ServiceStatus) => {
    switch (status) {
      case 'running': return 'RUNNING'
      case 'starting': return 'LOADING...'
      case 'error': return 'ERROR'
      default: return 'STOPPED'
    }
  }

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>Krakenum Monitor</h1>
          <span className="last-check">Updated: {lastCheck}</span>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={startAll}>Start All</button>
          <button className="btn-danger" onClick={stopAll}>Stop All</button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          {services.map((svc, i) => (
            <div 
              key={i} 
              className={`sidebar-item ${selected === i ? 'active' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span 
                className={`status-indicator ${svc.status === 'starting' ? 'pulse' : ''}`}
                style={{ background: getStatusColor(svc.status) }}
              />
              <span className="service-name">{svc.name}</span>
              <span className="service-port">:{svc.port}</span>
            </div>
          ))}
        </aside>

        <main className="content">
          <div className="service-header">
            <div className="service-info">
              <h2>{services[selected].name}</h2>
              <span 
                className={`badge ${services[selected].status}`}
                style={{ background: getStatusColor(services[selected].status) }}
              >
                {getStatusText(services[selected].status)}
              </span>
            </div>
            <div className="service-actions">
              <button className="btn-secondary" onClick={() => window.api.getStatus().then(setServices)}>Refresh</button>
            </div>
          </div>

          <div className="log-viewer">
            <div className="log-header">Logs</div>
            <div className="log-content">
              {services[selected].logs.length === 0 ? (
                <div className="log-empty">No logs yet...</div>
              ) : (
                services[selected].logs.map((log, i) => (
                  <div key={i} className="log-line">{log}</div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}