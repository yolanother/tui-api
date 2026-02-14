# Integration Prompt: TUI API Wrapper with Next.js

Use this prompt to guide an LLM (like ChatGPT, Claude, or Gemini) in integrating the `tui-api-wrapper` into a Next.js application.

---

**Role**: You are an expert Full-Stack Developer specializing in Next.js and Node.js.

**Task**: Integrate the `tui-api-wrapper` library into a Next.js application to embed a live terminal interface.

**Context**:
The `tui-api-wrapper` library provides a backend service that runs a TUI application (like `vim`, `htop`, or a custom script) and exposes it via:
1.  **WebSockets**: For streaming raw terminal data to the client.
2.  **REST API**:
    - **Send Raw Input**: `POST /api/input` with JSON `{ "data": "your command\r\n" }`.
    - **Send Special Key**: `POST /api/key` with JSON `{ "key": "arrowup" }`.
    - **Resize**: `POST /api/resize` with JSON `{ "cols": 80, "rows": 24 }`.
    - **Get Screen**: `GET /api/screen` returns JSON array of strings (lines).
    - **Get Screenshot**: `GET /api/screenshot` returns an image of the terminal.
        -   Default: Returns `image/svg+xml`.
        -   Header `Accept: image/png`: Returns `image/png`.

**Constraints & Considerations**:
-   **Native Dependencies**: `node-pty` (used by `tui-api-wrapper`) is a native C++ module. It **cannot** run in Vercel Edge Functions or standard Serverless Functions easily without specific configuration.
-   **Runtime**: It is recommended to run the `tui-api-wrapper` as:
    1.  A **Custom Next.js Server** (using `server.js`). This allows direct integration of the library code without a separate process.
    2.  A separate microservice (Node.js script) that the Next.js app connects to via API calls.

**Integration Steps for the LLM**:

1.  **Backend Setup (Direct Integration - Recommended)**:
    -   Create a `server.ts` (or `server.js`) file at the root of the Next.js project.
    -   Import `TerminalManager`, `setupRestEndpoints`, and `setupWebSocket` from `tui-api-wrapper`.
    -   Initialize `TerminalManager` with your desired command.
    -   Attach API endpoints to the Express app (or Next.js handler if compatible).
    -   Attach WebSocket to the HTTP server.
    -   Example:
        ```typescript
        import { createServer } from 'http';
        import { parse } from 'url';
        import next from 'next';
        import express from 'express';
        import { TerminalManager, setupRestEndpoints, setupWebSocket } from 'tui-api-wrapper';

        const dev = process.env.NODE_ENV !== 'production';
        const app = next({ dev });
        const handle = app.getRequestHandler();

        app.prepare().then(() => {
          const expressApp = express();
          const server = createServer(expressApp);

          // Initialize TUI
          const terminal = new TerminalManager({ 
            command: 'bash',
            args: [] 
          });

          // Setup TUI API Routes
          // This adds /api/screen, /api/input, /api/resize to expressApp
          setupRestEndpoints(expressApp, terminal);

          // Setup WebSocket
          setupWebSocket(server, terminal);

          // Handle all other requests with Next.js
          expressApp.all('*', (req, res) => {
            return handle(req, res);
          });

          server.listen(3000, (err) => {
            if (err) throw err;
            console.log('> Ready on http://localhost:3000');
          });
        });
        ```

2.  **Frontend Setup**:
    -   Install `xterm` and `xterm-addon-fit`.
    -   Create a `TerminalComponent.tsx`.
    -   Initialize `Terminal` from `xterm`.
    -   Connect to the WebSocket exposed by the custom server (e.g., `ws://localhost:3000`).
    -   On data received from WebSocket -> `term.write(data)`.
    -   On data input in `xterm` (`term.onData`) -> POST to `/api/input` OR send via WebSocket if supported.

3.  **Styling**:
    -   Ensure the terminal container has a fixed height/width or flex expansion to render correctly.
    -   Import `xterm/css/xterm.css`.

**Prompt to User**:
"Please configure the `tui-api-wrapper` in a custom server file to ensure `node-pty` operates correctly, and then build a React component using `xterm.js` to render the output."
