# ChatApp 💬

> A real-time chat application powered by WebSockets — instant messaging with no page refreshes.

ChatApp enables seamless, low-latency communication between users using native WebSockets over an Express.js server. Messages are delivered instantly across all connected clients in real time.

---

## Features

- ⚡ **Real-time messaging** — Instant message delivery using WebSockets
- 🔗 **Persistent connections** — No polling, no delays — true bidirectional communication
- 🖥️ **Express.js backend** — Lightweight and fast HTTP + WebSocket server
- 👥 **Multi-user support** — Multiple clients can connect and chat simultaneously
- 🌐 **Browser-based** — Works directly in the browser, no app install needed

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Real-time | WebSockets (ws) |
| Frontend | HTML / CSS / JavaScript |

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Arshit0508/chatapp.git
   cd chatapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node server.js
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## How It Works

1. Client connects to the server via a WebSocket handshake
2. Server maintains a list of all active connections
3. When a user sends a message, the server broadcasts it to all connected clients instantly
4. On disconnect, the connection is cleanly removed from the pool

```
Client A ──┐
           ├──► Express + WebSocket Server ──► Broadcasts to all
Client B ──┘
```

---

## Project Structure

```
chatapp/
├── server.js        # Express server + WebSocket logic
├── public/
│   ├── index.html   # Chat UI
│   ├── style.css    # Styling
│   └── client.js    # Frontend WebSocket client
└── package.json
```

---

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is open source. See [LICENSE](LICENSE) for details.
