import React, { useState, useEffect } from 'react';
import './App.css';
import Whiteboard from './components/Whiteboard';
import RoomManager from './components/RoomManager';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  name: string;
  role: 'creator' | 'editor' | 'viewer';
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

interface Room {
  id: string;
  name: string;
  creatorId: string;
  isPrivate: boolean;
  allowViewOnly: boolean;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('https://collaborative-whiteboard-backend-h1dm.onrender.com');
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('user-joined', (userData: User) => {
      setUsers(prev => [...prev.filter(u => u.id !== userData.id), userData]);
    });

    newSocket.on('user-left', (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    });

    newSocket.on('users-list', (usersList: User[]) => {
      setUsers(usersList);
    });

    newSocket.on('chat-message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    });

    newSocket.on('room-data', (roomData: Room) => {
      setRoom(roomData);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = (roomId: string, userData: User, roomData?: Room) => {
    if (socket) {
      socket.emit('join-room', { roomId, user: userData });
      setUser(userData);
      setRoom(roomData || { id: roomId, name: '', creatorId: '', isPrivate: false, allowViewOnly: false });
      setIsInRoom(true);
    }
  };

  const sendChatMessage = (message: string) => {
    if (socket && user && room) {
      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        userId: user.id,
        userName: user.name,
        message,
        timestamp: new Date()
      };
      socket.emit('chat-message', { roomId: room.id, message: chatMessage });
    }
  };

  const leaveRoom = () => {
    if (socket && room) {
      socket.emit('leave-room', room.id);
      setIsInRoom(false);
      setRoom(null);
      setUser(null);
      setUsers([]);
      setChatMessages([]);
    }
  };

  return (
    <div className="App">
      {!isInRoom ? (
        <RoomManager onJoinRoom={joinRoom} />
      ) : (
        <Whiteboard 
          socket={socket}
          user={user}
          room={room}
          users={users}
          chatMessages={chatMessages}
          onSendMessage={sendChatMessage}
          onLeaveRoom={leaveRoom}
        />
      )}
    </div>
  );
}

export default App;
