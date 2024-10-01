// server/server.ts

import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// טעינת משתני הסביבה מקובץ .env
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",  // זה מאפשר גישה מכל מקור. בסביבת ייצור, הגדר זאת לדומיין הספציפי שלך.
  }
});

interface User {
  id: string;
  name: string;
  room: string;
}

interface DecodedToken {
  name: string;
  room: string;
  iat: number;
  exp: number;
}

const users: User[] = [];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.post('/login', (req, res) => {
  const { name, room } = req.body;
  
  if (name && room) {
    const user = { name, room };
    const accessToken = jwt.sign(user, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });
    res.json({ accessToken });
    console.log('Token created:', accessToken);
  } else {
    res.status(400).json({ error: 'שם משתמש וחדר נדרשים' });
  }
});

io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as DecodedToken;
      (socket as any).decoded = decoded;
      next();
    } catch (err) {
      next(new Error('אימות נכשל'));
    }
  } else {
    next(new Error('נדרש אימות'));
  }
});

io.on('connection', (socket: Socket) => {
  console.log('משתמש התחבר');
  const user = (socket as any).decoded as DecodedToken;

  if (user) {
    const newUser: User = { id: socket.id, name: user.name, room: user.room };
    users.push(newUser);
    socket.join(newUser.room);

    socket.emit('message', { user: 'מערכת', text: `${newUser.name}, ברוך הבא לחדר ${newUser.room}!` });
    socket.broadcast.to(newUser.room).emit('message', { user: 'מערכת', text: `${newUser.name} הצטרף לחדר!` });

    io.to(newUser.room).emit('roomData', { room: newUser.room, users: users.filter(u => u.room === newUser.room) });
  }

  socket.on('sendMessage', (message: string) => {
    const user = users.find(user => user.id === socket.id);
    if (user) {
      io.to(user.room).emit('message', { user: user.name, text: message });
    }
  });

  socket.on('typing', (isTyping: boolean) => {
    const user = users.find(user => user.id === socket.id);
    if (user) {
      socket.broadcast.to(user.room).emit('typing', { user: user.name, isTyping });
    }
  });

  socket.on('disconnect', () => {
    const index = users.findIndex(user => user.id === socket.id);
    if (index !== -1) {
      const user = users.splice(index, 1)[0];
      io.to(user.room).emit('message', { user: 'מערכת', text: `${user.name} עזב את החדר.` });
      io.to(user.room).emit('roomData', { room: user.room, users: users.filter(u => u.room === user.room) });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`השרת פועל על פורט ${PORT}`));