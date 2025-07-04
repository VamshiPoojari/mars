import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  name: string;
  role: 'creator' | 'editor' | 'viewer';
}

interface Room {
  id: string;
  name: string;
  creatorId: string;
  isPrivate: boolean;
  allowViewOnly: boolean;
}

interface RoomManagerProps {
  onJoinRoom: (roomId: string, user: User, room?: Room) => void;
}

const RoomManager: React.FC<RoomManagerProps> = ({ onJoinRoom }) => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowViewOnly, setAllowViewOnly] = useState(false);
  const [joinAsViewer, setJoinAsViewer] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ FIXED: Removed frontend generateRoomId function - let backend handle it

  const createRoom = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userId = uuidv4();
      
      // ✅ FIXED: Send room creation request to backend - let backend generate ID
      const response = await fetch('https://collaborative-whiteboard-backend-h1dm.onrender.com/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomName.trim() || `${userName}'s Room`,
          isPrivate,
          allowViewOnly
        }),
      });

      if (response.ok) {
        // ✅ FIXED: Get the room ID generated by backend
        const result = await response.json();
        const backendRoomId = result.roomId;
        
        // ✅ FIXED: Create room data with backend-generated ID
        const roomData: Room = {
          id: backendRoomId,
          name: result.roomName || roomName.trim() || `${userName}'s Room`,
          creatorId: userId,
          isPrivate,
          allowViewOnly
        };

        const user: User = {
          id: userId,
          name: userName.trim(),
          role: 'creator'
        };
        
        console.log(`✅ Room created successfully with backend ID: ${backendRoomId}`);
        onJoinRoom(backendRoomId, user, roomData);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }
    } catch (err) {
      setError('Failed to create room. Please try again.');
      console.error('Room creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://collaborative-whiteboard-backend-h1dm.onrender.com/api/rooms/${roomId.toUpperCase()}`);
      
      if (response.ok) {
        const roomData: Room = await response.json();
        const userId = uuidv4();
        
        const user: User = {
          id: userId,
          name: userName.trim(),
          role: joinAsViewer ? 'viewer' : 'editor'
        };
        
        console.log(`✅ Joining room: ${roomId.toUpperCase()}`);
        onJoinRoom(roomId.toUpperCase(), user, roomData);
      } else if (response.status === 404) {
        setError('Room not found. Please check the room ID.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }
    } catch (err) {
      setError('Failed to join room. Please try again.');
      console.error('Room join error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-manager">
      <div className="room-manager-container">
        <h1>🎨 Collaborative Whiteboard</h1>
        <p>Real-time collaborative drawing and communication platform</p>
        
        <div className="user-input">
          <label htmlFor="userName">Your Name:</label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            maxLength={30}
          />
        </div>

        <div className="room-options">
          <button 
            className={`option-btn ${isCreating ? 'active' : ''}`}
            onClick={() => setIsCreating(true)}
          >
            🚀 Create New Room
          </button>
          <button 
            className={`option-btn ${!isCreating ? 'active' : ''}`}
            onClick={() => setIsCreating(false)}
          >
            🏠 Join Existing Room
          </button>
        </div>

        {isCreating ? (
          <div className="create-room">
            <div className="room-settings">
              <label htmlFor="roomName">Room Name (Optional):</label>
              <input
                id="roomName"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="My Awesome Whiteboard"
                maxLength={50}
              />
              
              <div className="room-permissions">
                <h3>🔒 Room Settings</h3>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Private Room (invitation only)
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allowViewOnly}
                    onChange={(e) => setAllowViewOnly(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Allow view-only participants
                </label>
              </div>
            </div>

            <button 
              className="primary-btn"
              onClick={createRoom}
              disabled={loading}
            >
              {loading ? '🔄 Creating...' : '🚀 Create & Join Room'}
            </button>
          </div>
        ) : (
          <div className="join-room">
            <label htmlFor="roomId">Room ID:</label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Enter 6-character room ID"
              maxLength={6}
            />

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={joinAsViewer}
                onChange={(e) => setJoinAsViewer(e.target.checked)}
              />
              <span className="checkmark"></span>
              Join as viewer only (can't edit)
            </label>

            <button 
              className="primary-btn"
              onClick={joinRoom}
              disabled={loading}
            >
              {loading ? '🔄 Joining...' : '🏠 Join Room'}
            </button>
          </div>
        )}

        {error && <div className="error-message">❌ {error}</div>}

        <div className="features-list">
          <h3>✨ Features Available</h3>
          <ul>
            <li>🎨 Advanced drawing tools (pen, shapes, text, eraser)</li>
            <li>🎯 Real-time collaboration with instant sync</li>
            <li>🎙️ Built-in voice chat for team communication</li>
            <li>💬 Live chat sidebar for text messaging</li>
            <li>👥 User presence and role management</li>
            <li>💾 Export as PNG or PDF documents</li>
            <li>⏪ Undo/Redo with full history</li>
            <li>🔒 Private rooms with access control</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .room-manager {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .room-manager-container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          max-width: 500px;
          width: 100%;
          text-align: center;
        }

        h1 { color: #333; margin-bottom: 10px; font-size: 2.5em; }
        
        p { color: #666; margin-bottom: 30px; }

        .user-input, .create-room, .join-room {
          margin-bottom: 20px;
        }

        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #333;
          text-align: left;
        }

        input[type="text"] {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 16px;
          margin-bottom: 15px;
          box-sizing: border-box;
        }

        input[type="text"]:focus {
          border-color: #667eea;
          outline: none;
        }

        .room-options {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
        }

        .option-btn {
          flex: 1;
          padding: 12px;
          border: 2px solid #ddd;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .option-btn.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .primary-btn {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .primary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .room-settings {
          text-align: left;
          margin-bottom: 20px;
        }

        .room-permissions {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 15px;
        }

        .room-permissions h3 {
          margin-top: 0;
          color: #333;
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          margin-bottom: 10px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          margin-right: 10px;
          width: auto;
        }

        .error-message {
          background: #fee;
          color: #c33;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .features-list {
          text-align: left;
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid #eee;
        }

        .features-list h3 {
          color: #333;
          margin-bottom: 15px;
        }

        .features-list ul {
          list-style: none;
          padding: 0;
        }

        .features-list li {
          padding: 5px 0;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default RoomManager;
