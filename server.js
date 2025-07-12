import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();
const app = express();
connectDB();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Use all routes from routes/index.js
app.use('/api', routes);

app.use(errorHandler);
app.get('/postman', (req, res) => {
    res.send('🚀 TaskAwayServer is running!');
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
