# ChatApp 💬

> A full-stack real-time chat application built with Node.js, Express.js, Socket.IO, MongoDB, and JWT authentication.

ChatApp provides real-time communication between authenticated users through persistent Socket.IO connections. It supports public chat rooms, private messaging, message history, online-user presence, user profiles, and persistent storage using MongoDB.

---

## ✨ Features

### 🔐 Authentication

* User registration and login
* JWT-based authentication
* Password hashing with `bcryptjs`
* Protected REST API endpoints
* JWT authentication for Socket.IO connections
* Persistent login token stored in the browser

### 💬 Real-Time Messaging

* Real-time message delivery using Socket.IO
* Persistent two-way communication
* Public chat rooms
* Private one-to-one messaging
* Room switching
* Typing indicators
* Emoji reactions
* Message timestamps
* Online-user status synchronized across connected clients

### 🗄️ Persistent Chat History

* Room messages stored in MongoDB
* Private messages stored in MongoDB
* Recent room history loaded when joining a room
* Private conversation history retrieved when opening a DM
* Mongoose schemas for structured message storage

### 👤 User Profiles

* User profile retrieval
* Display name management
* Bio management
* Profile data persisted in MongoDB

### 👥 Multi-User Support

* Multiple authenticated clients can connect simultaneously
* Online users are synchronized within chat rooms
* User join/leave events are broadcast in real time
* Tested manually with 5 simultaneous authenticated clients

---

## 🛠️ Tech Stack

| Layer                   | Technology            |
| ----------------------- | --------------------- |
| Runtime                 | Node.js               |
| Backend                 | Express.js            |
| Real-Time Communication | Socket.IO             |
| Database                | MongoDB               |
| ODM                     | Mongoose              |
| Authentication          | JSON Web Tokens (JWT) |
| Password Hashing        | bcryptjs              |
| Configuration           | dotenv                |
| Frontend                | HTML, CSS, JavaScript |
| API Format              | REST + JSON           |

---

## 🏗️ Architecture

ChatApp uses both REST APIs and Socket.IO connections.

```text
                         ┌──────────────────────┐
                         │      Browser         │
                         │ HTML / CSS / JS      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
              REST API                         Socket.IO
                    │                                │
                    ▼                                ▼
          ┌─────────────────────────────────────────────┐
          │              Express / Node.js              │
          │                                             │
          │  Authentication   User APIs   Room APIs    │
          │                                             │
          │        Real-Time Socket.IO Events           │
          └──────────────────────┬──────────────────────┘
                                 │
                                 ▼
                       ┌──────────────────┐
                       │     MongoDB      │
                       │                  │
                       │ Users            │
                       │ Rooms            │
                       │ Messages         │
                       └──────────────────┘
```

### Communication Flow

1. A user registers or logs in through the REST API.
2. The server validates the credentials and returns a JWT.
3. The frontend stores the JWT and uses it for authenticated requests.
4. The JWT is also supplied when establishing the Socket.IO connection.
5. The server verifies the token before accepting the socket connection.
6. Authenticated users can join chat rooms and communicate in real time.
7. Messages are persisted in MongoDB before being broadcast to connected clients.
8. Room history and private-message history are retrieved from MongoDB when requested.

---

## 🔑 Authentication Flow

Authentication is implemented using JWT.

```text
User
 │
 │ POST /api/auth/login
 ▼
Express API
 │
 │ Verify email + password
 ▼
MongoDB User
 │
 │ Password verified
 ▼
JWT generated
 │
 ▼
Browser
 │
 ├── REST requests
 │     Authorization: Bearer <token>
 │
 └── Socket.IO connection
       auth: { token: <token> }
```

Passwords are hashed before being stored using `bcryptjs`.

The JWT contains the authenticated user's ID and username and is verified by both the REST authentication middleware and Socket.IO middleware.

---

## 📡 REST API

### Authentication

#### Register

```http
POST /api/auth/register
```

Request:

```json
{
  "username": "arshit",
  "email": "arshit@example.com",
  "password": "password123"
}
```

#### Login

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "arshit@example.com",
  "password": "password123"
}
```

Returns a JWT token on successful authentication.

#### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

### Rooms

#### Get Available Rooms

```http
GET /api/rooms
Authorization: Bearer <token>
```

The application currently initializes the following rooms:

* `general`
* `tech`
* `random`

Rooms are stored in MongoDB and validated before a user joins them.

---

### User Profiles

#### Get Profile

```http
GET /api/users/profile
Authorization: Bearer <token>
```

#### Update Profile

```http
PUT /api/users/profile
Authorization: Bearer <token>
```

Example:

```json
{
  "displayName": "Arshit",
  "bio": "Computer Science student"
}
```

---

## ⚡ Socket.IO Events

The application uses Socket.IO for real-time communication.

### Client → Server

| Event            | Purpose                               |
| ---------------- | ------------------------------------- |
| `join`           | Join a chat room                      |
| `send_message`   | Send a room message                   |
| `send_dm`        | Send a private message                |
| `get_dm_history` | Retrieve private conversation history |
| `typing`         | Notify users that someone is typing   |
| `stop_typing`    | Stop typing notification              |
| `reaction`       | Add/remove message reactions          |

### Server → Client

| Event          | Purpose                           |
| -------------- | --------------------------------- |
| `room_history` | Send previous room messages       |
| `new_message`  | Deliver a new room message        |
| `new_dm`       | Deliver a private message         |
| `dm_history`   | Send private conversation history |
| `room_users`   | Synchronize online users          |
| `user_joined`  | Notify users when someone joins   |
| `user_left`    | Notify users when someone leaves  |
| `user_typing`  | Display typing indicator          |

---

## 🗃️ Database Design

MongoDB is used for persistent application data.

### User

Stores:

* Username
* Email
* Hashed password
* Display name
* Bio
* Creation/update timestamps

### Room

Stores:

* Room name
* Display name
* Creation/update timestamps

### Message

The message schema supports both room messages and private messages.

Room messages use:

```text
room
username
text
```

Private messages use:

```text
from
to
text
```

Messages also contain MongoDB timestamps.

---

## 📁 Project Structure

```text
chatapp/
│
├── frontend/
│   └── index.html
│
├── server/
│   ├── config/
│   │   └── db.js
│   │
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Room.js
│   │   └── Message.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── rooms.js
│   │   └── users.js
│   │
│   └── server.js
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* npm
* MongoDB Atlas account or a local MongoDB instance

---

### 1. Clone the Repository

```bash
git clone https://github.com/Arshit0508/chatapp.git
cd chatapp
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Configure Environment Variables

Create a `.env` file in the project root.

You can use `.env.example` as a template:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
```

Do not commit your real `.env` file or expose your MongoDB credentials or JWT secret.

---

### 4. Start the Server

```bash
node server/server.js
```

On successful startup, the server connects to MongoDB and initializes the default chat rooms.

You should see output similar to:

```text
MongoDB connected
Chat rooms ready
Chat Server running at http://localhost:3000
```

---

### 5. Open the Application

Open:

```text
http://localhost:3000
```

Register an account or log in with an existing account.

---

## 🧪 Testing

The application has been manually tested with multiple authenticated browser sessions.

The multi-user test verified:

* 5 simultaneous authenticated clients
* Successful Socket.IO connections
* Online-user synchronization
* Real-time room messaging
* User join/leave updates
* Private messaging
* Message persistence
* Chat history retrieval

The project is intended primarily as a learning and portfolio project, so performance figures are not presented as production benchmarks.

---

## 🔒 Security Considerations

The application currently includes:

* JWT authentication
* Password hashing using `bcryptjs`
* Protected REST endpoints
* JWT verification during Socket.IO connection
* Server-side message length validation
* Server-side room validation
* `.env` excluded from version control

For production deployment, additional protections such as rate limiting, HTTPS, stronger input validation, refresh-token handling, and more comprehensive authorization would be appropriate.

---

## 🧠 Key Engineering Concepts Demonstrated

This project demonstrates practical implementation of:

* RESTful API design
* JWT authentication
* Password hashing
* WebSocket-style real-time communication through Socket.IO
* Persistent bidirectional connections
* Event-driven server architecture
* MongoDB data persistence
* Mongoose schema design
* Client-server communication
* Room-based messaging
* Private messaging
* Online presence synchronization
* Asynchronous JavaScript
* Middleware-based authentication
* Error handling and server-side validation

---

## 🔮 Possible Future Improvements

Potential extensions include:

* Message pagination for large chat histories
* Persistent reaction storage
* Read receipts
* Message editing/deletion
* File and image sharing
* More granular room permissions
* Rate limiting
* Automated integration and concurrency tests
* Production deployment with HTTPS
* Improved frontend modularization

---

## 👨‍💻 Author

**Arshit**

Computer Science undergraduate at NIT Jalandhar.

GitHub: [Arshit0508](https://github.com/Arshit0508)

---

## 📄 License

This project is currently intended as a personal/educational portfolio project.
