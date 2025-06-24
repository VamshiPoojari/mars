import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);

// CORS options to allow both local development and production deployment
const corsOptions = {
  origin: [
    'http://localhost:3000',                                          // Local development
    'https://collaborative-whiteboard-ten.vercel.app',               // Your Vercel deployment
    /^https:\/\/collaborative-whiteboard.*\.vercel\.app$/           // Any Vercel preview deployments
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Apply CORS to Express app
app.use(cors(corsOptions));
app.use(express.json());

// Socket.io server with updated CORS
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://collaborative-whiteboard-ten.vercel.app',
      /^https:\/\/collaborative-whiteboard.*\.vercel\.app$/
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Define interfaces for better type safety
interface RoomData {
  id: string;
  name: string;
  isPrivate: boolean;
  createdAt: Date;
  users: UserData[];
  canvasData: string | null;
  lastActivity?: Date;
}

interface UserData {
  id: string;
  name: string;
  joinedAt: Date;
}

// Store room data
const rooms = new Map<string, RoomData>();

// Generate random room ID
const generateRoomId = (): string => {
  // Use timestamp + random for guaranteed uniqueness
  const timestamp = Date.now().toString(36).slice(-3);
  const random = Math.random().toString(36).substring(2, 5);
  return (timestamp + random).toUpperCase().substring(0, 6);
};

// Health check endpoint
app.get('/api/health', (req: any, res: any) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    message: '🚀 Backend is running with updated CORS configuration'
  });
});

// Debug endpoint to see all rooms
app.get('/api/debug/rooms', (req: any, res: any) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    users: room.users.length,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
    isPrivate: room.isPrivate
  }));
  
  res.json({ 
    totalRooms: rooms.size,
    rooms: roomList,
    timestamp: new Date().toISOString(),
    message: 'Debug endpoint - showing all active rooms'
  });
});

// REST API endpoints - Using simple any types to avoid complex Express generics
app.post('/api/rooms', (req: any, res: any) => {
  try {
    // Generate unique room ID (retry if collision)
    let roomId = generateRoomId();
    let attempts = 0;
    while (rooms.has(roomId) && attempts < 10) {
      roomId = generateRoomId();
      attempts++;
    }
    
    const { roomName, isPrivate } = req.body;
    
    const newRoom: RoomData = {
      id: roomId,
      name: roomName || `Room ${roomId}`,
      isPrivate: isPrivate || false,
      createdAt: new Date(),
      users: [],
      canvasData: null,
      lastActivity: new Date()
    };
    
    rooms.set(roomId, newRoom);
    
    console.log(`✅ Room created with NEW ID: ${roomId} - ${newRoom.name} (Total rooms: ${rooms.size})`);
    res.json({ 
      roomId, 
      message: 'Room created successfully',
      roomName: newRoom.name,
      totalRooms: rooms.size
    });
  } catch (error) {
    console.error('❌ Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});
app.get('/api/rooms/:roomId', (req: any, res: any) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = rooms.get(roomId);
    
    console.log(`🔍 Looking for room: ${roomId} (Total rooms: ${rooms.size})`);
    
    if (!room) {
      console.log(`❌ Room not found: ${roomId}`);
      console.log(`📝 Available rooms: ${Array.from(rooms.keys()).join(', ')}`);
      return res.status(404).json({ 
        error: 'Room not found',
        requestedRoom: roomId,
        availableRooms: Array.from(rooms.keys()),
        totalRooms: rooms.size
      });
    }
    
    console.log(`✅ Room found: ${roomId} - ${room.name}`);
    res.json({
      ...room,
      message: 'Room found successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 A user connected:', socket.id);

  // Join room
  socket.on('join-room', (data: { roomId: string; userName: string }) => {
    try {
      const { roomId, userName } = data;
      const upperRoomId = roomId.toUpperCase();
      const room = rooms.get(upperRoomId);
      
      console.log(`🏠 User ${userName} attempting to join room: ${upperRoomId}`);
      
      if (!room) {
        console.log(`❌ Socket join failed - Room not found: ${upperRoomId}`);
        console.log(`📝 Available rooms: ${Array.from(rooms.keys()).join(', ')}`);
        socket.emit('room-error', { 
          message: 'Room not found',
          requestedRoom: upperRoomId,
          availableRooms: Array.from(rooms.keys())
        });
        return;
      }
      
      // Join the socket room
      socket.join(upperRoomId);
      
      // Add user to room
      const user: UserData = {
        id: socket.id,
        name: userName || 'Anonymous',
        joinedAt: new Date()
      };
      
      room.users.push(user);
      room.lastActivity = new Date();
      
      // Notify user of successful join
      socket.emit('room-joined', { 
        roomId: upperRoomId, 
        roomName: room.name,
        users: room.users 
      });
      
      // Send existing canvas data to new user
      if (room.canvasData) {
        socket.emit('load-canvas', room.canvasData);
      }
      
      // Notify other users in room
      socket.to(upperRoomId).emit('user-joined', { user, users: room.users });
      
      console.log(`✅ User ${userName} joined room ${upperRoomId} (${room.users.length} users total)`);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('room-error', { message: 'Failed to join room' });
    }
  });

  // Handle drawing events
  socket.on('drawing', (data: any) => {
    try {
      const roomId = data.roomId;
      if (roomId) {
        // Broadcast to specific room
        socket.to(roomId).emit('drawing', data);
        
        // Update room canvas data
        const room = rooms.get(roomId);
        if (room) {
          room.lastActivity = new Date();
        }
      } else {
        // Fallback to broadcast to all (for backward compatibility)
        socket.broadcast.emit('drawing', data);
      }
    } catch (error) {
      console.error('❌ Error handling drawing:', error);
    }
  });

  // Handle clear canvas events
  socket.on('clear-canvas', (data?: { roomId?: string }) => {
    try {
      const roomId = data?.roomId;
      if (roomId) {
        socket.to(roomId).emit('clear-canvas');
        
        // Clear room canvas data
        const room = rooms.get(roomId);
        if (room) {
          room.canvasData = null;
          room.lastActivity = new Date();
        }
      } else {
        socket.broadcast.emit('clear-canvas');
      }
    } catch (error) {
      console.error('❌ Error clearing canvas:', error);
    }
  });

  // Handle undo events
  socket.on('undo', (data?: { roomId?: string }) => {
    try {
      const roomId = data?.roomId;
      if (roomId) {
        socket.to(roomId).emit('undo');
      } else {
        socket.broadcast.emit('undo');
      }
    } catch (error) {
      console.error('❌ Error handling undo:', error);
    }
  });

  // Handle redo events
  socket.on('redo', (data?: { roomId?: string }) => {
    try {
      const roomId = data?.roomId;
      if (roomId) {
        socket.to(roomId).emit('redo');
      } else {
        socket.broadcast.emit('redo');
      }
    } catch (error) {
      console.error('❌ Error handling redo:', error);
    }
  });

  // Save canvas state for room
  socket.on('save-canvas-state', (data: { roomId: string; canvasData: string }) => {
    try {
      const { roomId, canvasData } = data;
      const room = rooms.get(roomId);
      if (room) {
        room.canvasData = canvasData;
        room.lastActivity = new Date();
      }
    } catch (error) {
      console.error('❌ Error saving canvas state:', error);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    try {
      console.log('🔌 User disconnected:', socket.id);
      
      // Remove user from all rooms
      rooms.forEach((room: RoomData, roomId: string) => {
        const userIndex = room.users.findIndex((user: UserData) => user.id === socket.id);
        if (userIndex !== -1) {
          const user = room.users[userIndex];
          room.users.splice(userIndex, 1);
          room.lastActivity = new Date();
          
          // Notify other users in room
          socket.to(roomId).emit('user-left', { user, users: room.users });
          
          console.log(`👋 User ${user.name} left room ${roomId} (${room.users.length} users remaining)`);
          
          // Clean up empty rooms after 1 hour of inactivity
          if (room.users.length === 0) {
            console.log(`🧹 Room ${roomId} is now empty, will auto-cleanup after 1 hour`);
            setTimeout(() => {
              const currentRoom = rooms.get(roomId);
              if (currentRoom && currentRoom.users.length === 0) {
                const timeSinceActivity = Date.now() - (currentRoom.lastActivity?.getTime() || 0);
                if (timeSinceActivity > 3600000) { // 1 hour
                  rooms.delete(roomId);
                  console.log(`🗑️ Cleaned up empty room: ${roomId}`);
                }
              }
            }, 3600000); // Check after 1 hour
          }
        }
      });
    } catch (error) {
      console.error('❌ Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 CORS enabled for local development and Vercel deployment`);
  console.log(`🔍 Debug endpoint available at /api/debug/rooms`);
  console.log(`❤️ Health check available at /api/health`);
});
