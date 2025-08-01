import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Connection options for better reliability
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`📍 Host: ${conn.connection.host}`);
    console.log(`🗄️  Database: ${conn.connection.name}`);
    console.log(`🔌 Port: ${conn.connection.port}`);

    // Monitor connection events
    mongoose.connection.on('connected', () => {
      console.log('🟢 MongoDB connection established');
    });

    mongoose.connection.on('error', (err) => {
      console.error('🔴 MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🟡 MongoDB connection disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🟢 MongoDB connection reestablished');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔄 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ MongoDB Connection Failed!');
    console.error('🔍 Error Details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });

    // Don't exit immediately in production, let the app handle it
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    } else {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  }
};

export default connectDB;
