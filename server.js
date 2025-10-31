import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
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
import path from 'path';
import eventEmitter, {
  initEventListeners
} from './src/services/eventService.js';
import { NotificationService } from './src/services/notificationService.js';
import schedulerService from './src/services/schedulerService.js';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      // Development
      'http://localhost:5173',
      'http://13.53.134.0:5173',
      'http://13.53.134.0:5000',
      // Production domains
      'https://taskaway.com.au',
      'https://www.taskaway.com.au',
      'https://task-it-git-main-shamir1.vercel.app',
      'https://task-it-kappa.vercel.app',
      // Add any other domains you might use
      process.env.FRONTEND_BASE_URL
    ].filter(Boolean), // Remove any undefined values
    methods: ['GET', 'POST']
  }
});

connectDB();

// app.use(helmet());

// Rate limiting configuration
// General API rate limiter - 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message:
      'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});
app.use(
  cors({
    origin: [
      // Development
      'http://localhost:5173',
      'http://13.53.134.0:5173',
      'http://13.53.134.0:5000',
      // Production domains
      'https://taskaway.com.au',
      'https://www.taskaway.com.au',
      'https://task-it-git-main-shamir1.vercel.app',
      'https://task-it-kappa.vercel.app',
      // Add any other domains you might use
      process.env.FRONTEND_BASE_URL
    ].filter(Boolean)
  })
);
app.use(express.json());
app.use(morgan('dev'));

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) throw new Error('Authentication token required');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

  // Join user to their personal notification room
  socket.join(`user_${socket.user._id}`);
  console.log(`📡 User ${socket.user._id} joined notification room`);

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
      if (process.env.NODE_ENV === 'development') {
        console.log(`User ${socket.user._id} joined task chat: ${taskId}`);
      }
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

      // Emit message sent event for notifications
      eventEmitter.emit('message.sent', {
        taskId,
        senderId: socket.user._id,
        messageId: message._id
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`Message sent in task ${taskId} by ${socket.user._id}`);
      }
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
    // Leave user's notification room
    socket.leave(`user_${socket.user._id}`);

    if (process.env.NODE_ENV === 'development') {
      console.log(`User disconnected: ${socket.user._id}`);
      console.log(`📡 User ${socket.user._id} left notification room`);
    }
  });
});

// Health check endpoint for Elastic Beanstalk
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Database status endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const statusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    res.status(200).json({
      database: statusMap[dbStatus] || 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database status check failed',
      message: error.message
    });
  }
});

app.use('/api', routes);

// Serve static files from the frontend dist folder
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback: serve index.html for any route that does NOT start with /api
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use(errorHandler);

// Startup validation
console.log('🔍 Validating startup requirements...');

// Check critical environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please check your .env file or environment configuration');
  process.exit(1);
}

console.log('✅ Environment variables validated');

// Check MongoDB connection before starting server
try {
  await connectDB();
  initEventListeners();

  // Initialize notification service with Socket.IO
  NotificationService.initialize(io);

  schedulerService.start();
  console.log('✅ MongoDB connection validated');
} catch (error) {
  console.error('❌ MongoDB connection failed:', error.message);
  process.exit(1);
}

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || 'http://localhost';

// Enhanced server startup logging with error handling
server
  .listen(PORT, () => {
    console.log('🚀 TaskAway Server Started Successfully!');
    console.log(`📍 Server URL: ${HOST}:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(50));
  })
  .on('error', (error) => {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  });

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  schedulerService.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  schedulerService.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Unhandled error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
