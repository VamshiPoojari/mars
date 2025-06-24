import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import jsPDF from 'jspdf';

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

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

interface WhiteboardProps {
  socket: Socket | null;
  user: User | null;
  room: Room | null;
  users: User[];
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onLeaveRoom: () => void;
}

interface DrawingData {
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  color: string;
  tool: string;
  brushSize: number;
  isDrawing?: boolean;
}

const Whiteboard: React.FC<WhiteboardProps> = ({
  socket,
  user,
  room,
  users,
  chatMessages,
  onSendMessage,
  onLeaveRoom
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Chat states
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  
  // Voice chat states
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const canEdit = user?.role !== 'viewer';

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = 800;
        canvas.height = 600;
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
      }
    }
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('drawing', (data: DrawingData) => {
      drawOnCanvas(data);
    });

    socket.on('clear-canvas', () => {
      clearCanvas(false);
    });

    socket.on('canvas-state', (imageData: string) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          context?.clearRect(0, 0, canvas.width, canvas.height);
          context?.drawImage(img, 0, 0);
        };
        img.src = imageData;
      }
    });

    return () => {
      socket.off('drawing');
      socket.off('clear-canvas');
      socket.off('canvas-state');
    };
  }, [socket]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(imageData);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }
  };

  const undo = () => {
    if (historyIndex > 0 && canEdit) {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          setHistoryIndex(historyIndex - 1);
          context.putImageData(history[historyIndex - 1], 0, 0);
          
          if (socket && room) {
            const imageData = canvas.toDataURL();
            socket.emit('canvas-state', { roomId: room.id, imageData });
          }
        }
      }
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && canEdit) {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          setHistoryIndex(historyIndex + 1);
          context.putImageData(history[historyIndex + 1], 0, 0);
          
          if (socket && room) {
            const imageData = canvas.toDataURL();
            socket.emit('canvas-state', { roomId: room.id, imageData });
          }
        }
      }
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canEdit) return;
    
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPos(pos);

    if (tool === 'pen' || tool === 'eraser') {
      drawOnCanvas({
        x: pos.x,
        y: pos.y,
        color: tool === 'eraser' ? '#FFFFFF' : color,
        tool,
        brushSize,
        isDrawing: true
      });
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canEdit) return;

    const pos = getMousePos(e);

    if (tool === 'pen' || tool === 'eraser') {
      const drawingData: DrawingData = {
        x: pos.x,
        y: pos.y,
        prevX: startPos.x,
        prevY: startPos.y,
        color: tool === 'eraser' ? '#FFFFFF' : color,
        tool,
        brushSize,
        isDrawing: true
      };

      drawOnCanvas(drawingData);
      
      if (socket && room) {
        socket.emit('drawing', { roomId: room.id, ...drawingData });
      }

      setStartPos(pos);
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canEdit) return;

    const pos = getMousePos(e);

    if (tool === 'rectangle' || tool === 'circle') {
      const drawingData: DrawingData = {
        x: startPos.x,
        y: startPos.y,
        prevX: pos.x,
        prevY: pos.y,
        color,
        tool,
        brushSize,
        isDrawing: false
      };

      drawOnCanvas(drawingData);
      
      if (socket && room) {
        socket.emit('drawing', { roomId: room.id, ...drawingData });
      }
    } else if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text && text.trim()) {
        const drawingData: DrawingData = {
          x: pos.x,
          y: pos.y,
          color,
          tool,
          brushSize: fontSize,
          isDrawing: false
        };

        drawText(text, drawingData);
        
        if (socket && room) {
          socket.emit('drawing', { roomId: room.id, ...drawingData, text });
        }
      }
    }

    setIsDrawing(false);
    saveToHistory();
  };

  const drawOnCanvas = (data: DrawingData & { text?: string }) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.strokeStyle = data.color;
        context.lineWidth = data.brushSize;
        context.lineCap = 'round';

        switch (data.tool) {
          case 'pen':
          case 'eraser':
            if (data.prevX !== undefined && data.prevY !== undefined) {
              context.beginPath();
              context.moveTo(data.prevX, data.prevY);
              context.lineTo(data.x, data.y);
              context.stroke();
            }
            break;

          case 'rectangle':
            if (data.prevX !== undefined && data.prevY !== undefined && !data.isDrawing) {
              context.strokeRect(
                data.x,
                data.y,
                data.prevX - data.x,
                data.prevY - data.y
              );
            }
            break;

          case 'circle':
            if (data.prevX !== undefined && data.prevY !== undefined && !data.isDrawing) {
              const radius = Math.sqrt(
                Math.pow(data.prevX - data.x, 2) + Math.pow(data.prevY - data.y, 2)
              );
              context.beginPath();
              context.arc(data.x, data.y, radius, 0, 2 * Math.PI);
              context.stroke();
            }
            break;

          case 'text':
            if (data.text && !data.isDrawing) {
              drawText(data.text, data);
            }
            break;
        }
      }
    }
  };

  const drawText = (text: string, data: DrawingData) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = data.color;
        context.font = `${data.brushSize}px Arial`;
        context.fillText(text, data.x, data.y);
      }
    }
  };

  const clearCanvas = (emit = true) => {
    if (!canEdit && emit) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        if (emit && socket && room) {
          socket.emit('clear-canvas', room.id);
        }
        
        saveToHistory();
      }
    }
  };

  const exportToPNG = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `whiteboard-${room?.id}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const exportToPDF = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('landscape');
      pdf.addImage(imgData, 'JPEG', 10, 10, 277, 190);
      pdf.save(`whiteboard-${room?.id}-${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${room?.id}`;
    navigator.clipboard.writeText(link);
    alert('Room link copied to clipboard!');
  };

  // Voice chat functions
  const startVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setIsVoiceChatActive(true);
      
      if (socket && room) {
        socket.emit('start-voice-chat', room.id);
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopVoiceChat = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsVoiceChatActive(false);
    
    if (socket && room) {
      socket.emit('stop-voice-chat', room.id);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      onSendMessage(chatMessage);
      setChatMessage('');
    }
  };

  return (
    <div className="whiteboard-container">
      {/* Header */}
      <div className="header">
        <div className="room-info">
          <h2>🎨 {room?.name || `Room ${room?.id}`}</h2>
          <span className="room-id">Room ID: {room?.id}</span>
          <button onClick={copyRoomLink} className="copy-link-btn">
            📋 Copy Link
          </button>
        </div>

        <div className="users-list">
          <span>👥 {users.length} user{users.length !== 1 ? 's' : ''} online:</span>
          {users.map(u => (
            <span key={u.id} className={`user-badge ${u.role}`}>
              {u.name} {u.role === 'creator' && '👑'} {u.role === 'viewer' && '👁️'}
            </span>
          ))}
        </div>

        <button onClick={onLeaveRoom} className="leave-btn">
          🚪 Leave Room
        </button>
      </div>

      <div className="main-content">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="tool-group">
            <button 
              className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
              onClick={() => setTool('pen')}
              disabled={!canEdit}
            >
              ✏️ Pen
            </button>
            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
              onClick={() => setTool('eraser')}
              disabled={!canEdit}
            >
              🧹 Eraser
            </button>
            <button 
              className={`tool-btn ${tool === 'rectangle' ? 'active' : ''}`}
              onClick={() => setTool('rectangle')}
              disabled={!canEdit}
            >
              ▭ Rectangle
            </button>
            <button 
              className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
              onClick={() => setTool('circle')}
              disabled={!canEdit}
            >
              ⭕ Circle
            </button>
            <button 
              className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
              onClick={() => setTool('text')}
              disabled={!canEdit}
            >
              📝 Text
            </button>
          </div>

          <div className="tool-group">
            <label>Color:</label>
            <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)}
              disabled={!canEdit}
            />
            
            <label>Size:</label>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={tool === 'text' ? fontSize : brushSize}
              onChange={(e) => tool === 'text' ? setFontSize(Number(e.target.value)) : setBrushSize(Number(e.target.value))}
              disabled={!canEdit}
            />
            <span>{tool === 'text' ? fontSize : brushSize}px</span>
          </div>

          <div className="tool-group">
            <button onClick={undo} disabled={historyIndex <= 0 || !canEdit}>↩️ Undo</button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1 || !canEdit}>↪️ Redo</button>
            <button onClick={() => clearCanvas()} disabled={!canEdit}>🗑️ Clear</button>
          </div>

          <div className="tool-group">
            <button onClick={exportToPNG}>📸 PNG</button>
            <button onClick={exportToPDF}>📄 PDF</button>
          </div>

          <div className="tool-group voice-controls">
            {!isVoiceChatActive ? (
              <button onClick={startVoiceChat} className="voice-btn start">
                🎙️ Start Voice
              </button>
            ) : (
              <>
                <button onClick={toggleMute} className={`voice-btn ${isMuted ? 'muted' : 'unmuted'}`}>
                  {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
                </button>
                <button onClick={stopVoiceChat} className="voice-btn stop">
                  🔴 Stop Voice
                </button>
              </>
            )}
          </div>
        </div>

        <div className="canvas-area">
          {/* Canvas */}
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{ cursor: canEdit ? 'crosshair' : 'not-allowed' }}
            />
            {!canEdit && (
              <div className="viewer-overlay">
                👁️ View Only Mode
              </div>
            )}
          </div>

          {/* Chat Sidebar */}
          {showChat && (
            <div className="chat-sidebar">
              <div className="chat-header">
                <span>💬 Chat</span>
                <button onClick={() => setShowChat(false)}>❌</button>
              </div>
              
              <div className="chat-messages">
                {chatMessages.map(msg => (
                  <div key={msg.id} className="chat-message">
                    <div className="message-author">
                      {msg.userName} <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-text">{msg.message}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="chat-input">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={500}
                />
                <button type="submit">Send</button>
              </form>
            </div>
          )}
        </div>

        {!showChat && (
          <button onClick={() => setShowChat(true)} className="show-chat-btn">
            💬 Show Chat
          </button>
        )}
      </div>

      <style jsx>{`
        .whiteboard-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          background: white;
          border-bottom: 1px solid #ddd;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .room-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .room-info h2 {
          margin: 0;
          color: #333;
        }

        .room-id {
          background: #e9ecef;
          padding: 5px 10px;
          border-radius: 15px;
          font-size: 14px;
          font-weight: bold;
        }

        .copy-link-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 5px;
          cursor: pointer;
        }

        .users-list {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .user-badge {
          background: #e9ecef;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 12px;
        }

        .user-badge.creator {
          background: #ffd700;
          color: #333;
        }

        .user-badge.viewer {
          background: #17a2b8;
          color: white;
        }

        .leave-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 5px;
          cursor: pointer;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          padding: 15px;
          background: white;
          border-bottom: 1px solid #ddd;
          align-items: center;
        }

        .tool-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tool-btn {
          padding: 8px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tool-btn:hover:not(:disabled) {
          background: #f8f9fa;
        }

        .tool-btn.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .tool-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .voice-controls .voice-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        }

        .voice-btn.start {
          background: #28a745;
          color: white;
        }

        .voice-btn.stop {
          background: #dc3545;
          color: white;
        }

        .voice-btn.unmuted {
          background: #ffc107;
          color: #333;
        }

        .voice-btn.muted {
          background: #6c757d;
          color: white;
        }

        .canvas-area {
          flex: 1;
          display: flex;
          position: relative;
        }

        .canvas-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          position: relative;
        }

        canvas {
          border: 2px solid #ddd;
          border-radius: 8px;
          background: white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .viewer-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: bold;
          pointer-events: none;
        }

        .chat-sidebar {
          width: 300px;
          background: white;
          border-left: 1px solid #ddd;
          display: flex;
          flex-direction: column;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border-bottom: 1px solid #ddd;
          font-weight: bold;
        }

        .chat-header button {
          background: none;
          border: none;
          cursor: pointer;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          max-height: 400px;
        }

        .chat-message {
          margin-bottom: 15px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .message-author {
          font-weight: bold;
          color: #007bff;
          font-size: 12px;
          margin-bottom: 3px;
        }

        .message-time {
          font-weight: normal;
          color: #6c757d;
        }

        .message-text {
          color: #333;
        }

        .chat-input {
          display: flex;
          padding: 15px;
          border-top: 1px solid #ddd;
        }

        .chat-input input {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 5px;
          margin-right: 8px;
        }

        .chat-input button {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 5px;
          cursor: pointer;
        }

        .show-chat-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 25px;
          cursor: pointer;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          z-index: 1000;
        }

        label {
          font-size: 12px;
          color: #666;
        }

        input[type="color"] {
          width: 40px;
          height: 30px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }

        input[type="range"] {
          width: 80px;
        }
      `}</style>
    </div>
  );
};

export default Whiteboard;
