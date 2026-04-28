# Krakenum Monitor

Desktop application to monitor and control KVP blockchain backend services.

## Features

- **One-click Start/Stop** - Start all backend services with single click
- **Real-time monitoring** - View logs and status for each service
- **Auto tunnel deployment** - Automatically starts Cloudflare tunnels and Vercel deployment
- **Vercel verification** - Polls Vercel API to confirm deployment READY
- **Status indicators** - Visual status (yellow = waiting, green = ALL READY)

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

First, create `.env` file:
```
VERCEL_TOKEN=your_vercel_token
VERCEL_BLOCKCHAIN_PROJ=prj_xxx
VERCEL_WALLET_PROJ=prj_xxx
```

Then click "Start All" in the app.

### Build Executable

```bash
npm run build
npm run package
```

## Flow

1. **Kill ports** - Removes any processes using ports 8088, 8090, 8098
2. **Start services** - Starts Rust Node, Go Gateway, Wallet BE
3. **Wait for running** - Waits until all services verified
4. **Tunnel + Deploy** - Runs tunnel script + Vercel deployment
5. **Verify READY** - Polls Vercel API until deployment READY
6. **ALL READY** - Green indicator when everything up!

## Requirements

- Node.js 18+
- Rust (for blockchain backend)
- Go (for gateway)
- Cloudflared (for tunnels)
- PowerShell (for deployment scripts)
- Vercel account with token

## Author

Created by Krakenum Foundation