import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './src/config/db.js';
import routes from './src/routes/index.js';
import errorHandler from './src/middleware/errorHandler.js';
import { Server } from 'socket.io';
import Task from './src/models/Task.js';
import Message from './src/models/Message.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import User from './src/models/User.js';
import mongoose from 'mongoose';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ' http://localhost:5173', methods: ['GET', 'POST'] }
});

connectDB();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) throw new Error('Authentication token required');
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Socket authenticated:', decoded);
      const user = await User.findById(decoded.id);
      if (!user) throw new Error('User not found');
  
      // Attach full user data to socket
      socket.user = user;
  
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Authentication error'));
    }
  });
  
  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user._id}`);

    // Join task chat room
    socket.on('joinTaskChat', async (taskId) => {
      try {
        // Validate taskId and user access
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
          socket.emit('error', 'Invalid task ID');
          return;
        }

        const task = await Task.findById(taskId);
        if (!task) {
          socket.emit('error', 'Task not found');
          return;
        }

        // Check if user is createdBy or assignedTo
        // const isOwner = task.createdBy.toString() === socket.user._id;
        // const isAssignee =
        //   task.assignedTo && task.assignedTo.toString() === socket.user._id;
        // if (!isOwner && !isAssignee) {
        //   socket.emit('error', 'Unauthorized access to chat');
        //   return;
        // }

        // Join task-specific room
        socket.join(taskId);
        console.log(`User ${socket.user._id} joined task chat: ${taskId}`);
      } catch (err) {
        socket.emit('error', 'Server error');
        console.error('Join task chat error:', err.message);
      }
    });

    // Handle sending message
    socket.on('sendMessage', async ({ taskId, content }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
          socket.emit('error', 'Invalid task ID');
          return;
        }

        const task = await Task.findById(taskId);
        if (!task) {
          socket.emit('error', 'Task not found');
          return;
        }

        const isOwner = task.createdBy.toString() === socket.user._id;
        const isAssignee =
          task.assignedTo && task.assignedTo.toString() === socket.user._id;
        // if (!isOwner && !isAssignee) {
        //   socket.emit('error', 'Unauthorized to send message');
        //   return;
        // }

        // Save message to MongoDB
        const message = new Message({
          taskId,
          senderId: socket.user._id,
          content
        });
        await message.save();

        // Populate sender details
        const populatedMessage = await Message.findById(message._id).populate(
          'senderId',
          'name email'
        );

        // Broadcast message to task room
        io.to(taskId).emit('receiveMessage', populatedMessage);
        console.log(`Message sent in task ${taskId} by ${socket.user._id}`);
      } catch (err) {
        socket.emit('error', 'Failed to send message');
        console.error('Send message error:', err.message);
      }
    });

    // Handle typing indicator
    socket.on('typingStarted', (taskId) => {
      socket.broadcast
        .to(taskId)
        .emit('typingStarted', { userId: socket.user._id });
    });

    socket.on('typingStopped', (taskId) => {
      socket.broadcast
        .to(taskId)
        .emit('typingStopped', { userId: socket.user._id });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user._id}`);
    });
  });


app.use('/api', routes);

app.use(errorHandler);
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'http://localhost';
server.listen(PORT, () => console.log(`Server running at ${HOST}:${PORT}`));
