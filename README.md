# Krakenum Monitor

Desktop application to monitor and control KVP blockchain backend services.

## Features

- **One-click Start/Stop** - Start all backend services with single click
- **Real-time monitoring** - View logs and status for each service
- **Auto tunnel deployment** - Automatically starts Cloudflare tunnels and Vercel deployment
- **Status indicators** - Visual status (🔴 stopped, 🟡 loading, 🟢 running)

## Services

- Rust Node (port 8088) - Blockchain backend
- Go Gateway (port 8090) - API gateway  
- Wallet BE (port 8098) - Wallet backend

## How to Use

### Development

```bash
cd KrakenumMonitor
npm install
npm run dev
```

Then click "Start All" button in the app.

### Build Executable

```bash
npm run build
npm run package
```

## Requirements

- Node.js 18+
- Rust (for blockchain backend)
- Go (for gateway)
- Cloudflared (for tunnels)
- PowerShell (for deployment scripts)

## Flow

1. **Kill existing** - Removes any processes using ports 8088, 8090, 8098
2. **Start services** - Starts Rust Node, Go Gateway, Wallet BE
3. **Wait for green** - Waits until all services verified running
4. **Deploy** - Runs tunnel script + Vercel deployment (~35s)
5. **Ready** - All services and web up!

## Author

Created by Krakenum Foundation