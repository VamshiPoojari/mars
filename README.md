# Collaborative Whiteboard

A real-time collaborative whiteboard application that allows multiple users to draw, write, and interact simultaneously on a shared canvas.

## 🌟 Features

### Core Drawing Tools
- **Pen Tool**: Free-hand drawing with customizable colors and brush sizes
- **Shape Tools**: Rectangle and circle drawing with drag-to-create functionality  
- **Text Tool**: Click-to-add text with scalable font sizes
- **Eraser Tool**: Remove parts of drawings with adjustable eraser size
- **Color Picker**: Full spectrum color selection for all drawing tools

### Real-Time Collaboration
- **Live Drawing Sync**: See other users' drawings appear instantly as they draw
- **Room-Based Sessions**: Create or join specific rooms via shareable links
- **Multi-User Support**: Unlimited users can collaborate simultaneously
- **User Management**: See who's in your room and when users join/leave

### Canvas Management
- **Undo/Redo**: Step backward and forward through drawing history
- **Clear Canvas**: Reset the entire whiteboard for all users
- **Canvas Persistence**: Drawings are saved and restored when new users join rooms

### Save & Export
- **PNG Export**: Download whiteboard as high-quality PNG image
- **PDF Export**: Print or save whiteboard as PDF document
- **Auto-Naming**: Exported files include room ID and date for organization

### Room Features
- **Room Creation**: Generate unique room IDs for new collaboration sessions
- **Room Joining**: Join existing rooms using 6-character room codes
- **Shareable Links**: Copy and share direct room access links
- **Room Persistence**: Canvas state is maintained for the room session

## 🛠️ Tech Stack

### Frontend
- **React.js** with TypeScript for type-safe component development
- **HTML5 Canvas API** for high-performance drawing operations
- **Socket.io Client** for real-time bidirectional communication
- **Custom CSS** for responsive and intuitive UI design

### Backend
- **Node.js** runtime environment
- **Express.js** web application framework
- **Socket.io** for WebSocket-based real-time communication
- **TypeScript** for enhanced code reliability and developer experience

### Development Tools
- **VS Code** as the primary development environment
- **npm** for package management and build scripts
- **nodemon** for automatic server restarts during development

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- Modern web browser with HTML5 Canvas support

### Installation

1. **Clone the repository**
git clone https://github.com/VamshiPoojari/collaborative-whiteboard.git
cd collaborative-whiteboard

text

2. **Install backend dependencies**
cd server
npm install

text

3. **Install frontend dependencies**
cd ../client
npm install

text

### Running the Application

1. **Start the backend server**
cd server
npm run dev

text
Server will run on `http://localhost:5000`

2. **Start the frontend application**
cd client
npm start

text
Application will open on `http://localhost:3000`

### Usage

1. **Create a New Room**
- Enter your name
- Click "Create New Room"
- Optionally set a room name
- Start drawing!

2. **Join Existing Room**
- Enter your name
- Click "Join Existing Room"
- Enter the 6-character room ID
- Join the collaboration!

3. **Share Your Room**
- Click "📋 Copy Room Link" in the room header
- Share the link with collaborators
- They can join directly via the shared link

## 🎯 Project Structure

collaborative-whiteboard/
├── client/ # React frontend application
│ ├── public/ # Static assets
│ ├── src/
│ │ ├── components/ # React components
│ │ │ ├── Whiteboard.tsx # Main whiteboard canvas component
│ │ │ └── RoomManager.tsx # Room creation/joining interface
│ │ ├── App.tsx # Main application component
│ │ └── index.tsx # React application entry point
│ └── package.json # Frontend dependencies
├── server/ # Node.js backend application
│ ├── server.ts # Express server with Socket.io
│ ├── tsconfig.json # TypeScript configuration
│ └── package.json # Backend dependencies
├── .gitignore # Git ignore rules
└── README.md # Project documentation

text

## 🔧 API Endpoints

### REST API
- `POST /api/rooms` - Create a new collaboration room
- `GET /api/rooms/:roomId` - Get room information and verify existence

### WebSocket Events
- `join-room` - Join a specific room for collaboration
- `drawing` - Real-time drawing data synchronization
- `clear-canvas` - Synchronize canvas clearing across users
- `undo` / `redo` - Synchronize undo/redo operations
- `save-canvas-state` - Persist canvas data for room

## 🌐 Demo

**Live Demo:** [Deploy your application and add the live demo link here]

**Repository:** https://github.com/VamshiPoojari/collaborative-whiteboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built as part of a web development learning project
- Inspired by collaborative tools like Miro and Figma
- Thanks to the open-source community for amazing libraries and tools

## 📧 Contact

**Developer:** Vamshi Poojari  
**Repository:** https://github.com/VamshiPoojari/collaborative-whiteboard
