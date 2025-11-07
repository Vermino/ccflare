# ccflare Desktop

A native desktop application for ccflare built with Tauri 2.0.

## Features

- **Native Desktop Experience**: Run ccflare with a native desktop interface
- **Integrated Server Management**: Start/stop the ccflare server directly from the app
- **System Tray Integration**: Quick access from the system tray (coming soon)
- **Auto-start Server**: Automatically start the server when the app launches
- **Health Monitoring**: Real-time server health checking
- **Cross-platform**: Windows, macOS, and Linux support
- **Environment Integration**: Use `ANTHROPIC_BASE_URL=http://localhost:8080` for API routing

## Architecture

The desktop app consists of two main parts:

1. **Frontend**: Uses the existing `@ccflare/dashboard-web` React app
2. **Backend**: Rust-based Tauri application for native system integration

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Bun](https://bun.sh/) (for web assets)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites/) 2.0+

### Setup

```bash
# Install dependencies
bun install

# Install Tauri CLI (if not already installed)
npm install -g @tauri-apps/cli@latest

# Run in development mode
bun run dev
```

### Building

```bash
# Build web assets and create desktop binary
bun run build
```

#### Build Outputs

After building, you'll find the following files:

**Development Build (Debug)**
```
apps/desktop/src-tauri/target/debug/ccflare-desktop.exe
```
- ~16.7 MB (unoptimized with debug symbols)
- Use for development and testing

**Production Build (Release)**
```
apps/desktop/src-tauri/target/release/ccflare-desktop.exe
```
- ~12.3 MB (optimized)
- Standalone executable - no installation required

**Installers (Distribution Ready)**
```
apps/desktop/src-tauri/target/release/bundle/msi/ccflare Desktop_1.0.0_x64_en-US.msi
apps/desktop/src-tauri/target/release/bundle/nsis/ccflare Desktop_1.0.0_x64-setup.exe
```

## Commands

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build production binary
- `bun run preview` - Preview built app without dev server
- `bun run tauri` - Run Tauri CLI commands directly

## Usage

### API Routing Setup

To route Claude API calls through ccflare, set the environment variable:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8080
```

This ensures only Anthropic API calls go through the ccflare load balancer while other web traffic remains unaffected.

### Running the App

1. **Make sure ccflare server is running** on port 8080:
   ```bash
   bun start  # from project root
   ```

2. **Run the desktop app**:
   ```bash
   # Development
   bun run dev
   
   # Or run the built executable directly
   ./apps/desktop/src-tauri/target/release/ccflare-desktop.exe
   ```

## Configuration

The app configuration is in `src-tauri/tauri.conf.json`:

- **Window settings**: Size, title, decorations
- **Security**: CSP policies for web content
- **Bundle settings**: App metadata, icons, platform-specific options
- **Plugins**: Enabled Tauri plugins for system integration

## Native Features

### Server Management

The desktop app can manage the ccflare server process:

- Start server on app launch
- Stop server when app closes
- Monitor server health
- Display server status in UI

### System Integration

- Native file system access for config files
- System notifications for important events
- Shell integration for running server commands
- HTTP client for API communication
- Cross-origin requests between desktop app (port 8081) and ccflare server (port 8080)

## Security

The app uses Tauri's security model:

- **Content Security Policy**: Restricts web content access
- **API Scoping**: Limits which system APIs can be accessed
- **Plugin System**: Only enabled plugins have system access

## Distribution

### Windows
- `.msi` installer
- Portable `.exe`

### macOS
- `.dmg` disk image
- `.app` bundle

### Linux
- `.deb` package (Debian/Ubuntu)
- `.rpm` package (Red Hat/Fedora)
- `.AppImage` (universal Linux)

## Troubleshooting

### Server Won't Start
1. Check if bun is installed: `bun --version`
2. Check if port 8080 is available
3. Verify project directory structure
4. Check console logs in dev tools (F12)

### Build Errors
1. Ensure Rust is installed: `rustc --version`
2. Update Tauri CLI: `npm update -g @tauri-apps/cli`
3. Clear cache: `rm -rf src-tauri/target`
4. Check system prerequisites

## Important Notes

### No System Proxy Management
This desktop app **does not** modify your system's proxy settings. Instead, it uses the standard approach of setting `ANTHROPIC_BASE_URL=http://localhost:8080` to route only Claude API calls through ccflare.

### Port Configuration
- **Desktop App**: Runs on port 8081 (development) or bundled (production)
- **ccflare Server**: Must be running on port 8080
- **API Routing**: Set `ANTHROPIC_BASE_URL=http://localhost:8080` for your Claude SDK

## Development Roadmap

- [ ] System tray integration
- [ ] Auto-updater configuration
- [x] Custom app icons
- [ ] Notification system for rate limits
- [ ] Quick settings panel
- [ ] Multiple server profile support