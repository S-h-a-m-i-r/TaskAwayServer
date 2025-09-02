const request = require('supertest');
const app = require('../../../app'); // Adjust the path as necessary

describe('Auth Routes', () => {
    it('should respond with 200 for login', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'testpass' });
        expect(response.statusCode).toBe(200);
    });

    it('should respond with 401 for invalid login', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'wrongpass' });
        expect(response.statusCode).toBe(401);
    });

    it('should respond with 200 for registration', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: 'newuser', password: 'newpass' });
        expect(response.statusCode).toBe(200);
    });
});