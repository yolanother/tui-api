# TUI API Wrapper

A powerful libraries that wraps terminal TUI applications, exposing them via a REST API and WebSocket. This allows you to embed terminal applications into web interfaces, control them programmatically, and stream their output in real-time.

## Features

- **Process Management**: Spawns and manages TUI processes using `node-pty`.
- **Screen Capture**: Maintains a server-side representation of the terminal screen.
- **REST API**:
  - `GET /api/screen`: Get the current terminal screen content.
  - `GET /api/screenshot`: Get the current terminal screen as an image.
    - Default: Returns `image/svg+xml`.
    - Header `Accept: image/png`: Returns `image/png`.
  - `POST /api/input`: Send raw text to the process.
    - Body: `{ "data": "ls -la\r\n" }`
  - `POST /api/key`: Send a special key.
    - Body: `{ "key": "enter" }` (Supported: up, down, left, right, enter, tab, backspace, escape, home, end, pageup, pagedown, delete, insert)
  - `POST /api/resize`: Resize the terminal dimensions.
    - Body: `{ "cols": 100, "rows": 40 }`
- **WebSocket**: Streams raw terminal output for real-time client-side rendering (e.g., using xterm.js).
- **CLI**: Run any TUI app instantly via command line.
- **TypeScript Support**: Written in TypeScript with full type definitions.

## Installation

### Local Installation (for use in a project)

```bash
npm install tui-api-wrapper
```

### Global Installation (for CLI usage)

You can install the package globally to use the `tui-api` command anywhere.

```bash
npm install -g tui-api-wrapper
```

### Development / Linking

If you are developing this package locally, you can link it globally:

```bash
npm install
npm run build
npm link
```

Then you can run `tui-api` directly.

## Usage

### CLI

```bash
# Run a TUI app
npx tui-api --command "vim" --port 3000
```

Once running, you can open `http://localhost:3000` in your browser to view and interact with the TUI using the built-in web frontend.

### Library / Programmatic Usage

You can use the `TerminalManager` class directly in your Node.js application (e.g., Express, Next.js Custom Server).

#### Basic Example

```typescript
import { TerminalManager, createServer } from 'tui-api-wrapper';

const terminal = new TerminalManager({
  command: 'top',
  args: [],
  cwd: process.cwd(),
});

const app = createServer(terminal);

app.listen(3000, () => {
  console.log('TUI API running on port 3000');
});
```

#### Advanced Integration (e.g., with existing Express App)

```typescript
import express from 'express';
import { createServer } from 'http';
import { TerminalManager, setupRestEndpoints, setupWebSocket } from 'tui-api-wrapper';

const app = express();
const server = createServer(app);

const terminal = new TerminalManager({ command: 'bash' });

// Add TUI API routes to your existing Express app
setupRestEndpoints(app, terminal);

// Attach WebSocket server to your existing HTTP server
setupWebSocket(server, terminal);

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Integration with Next.js

See [INTEGRATION_PROMPT.md](./INTEGRATION_PROMPT.md) for detailed instructions on how to integrate this library into a Next.js application using an LLM.

## License
ISC
