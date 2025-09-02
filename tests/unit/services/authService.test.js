const authService = require('../../../services/authService');

describe('authService', () => {
	test('should return user data for valid credentials', async () => {
		const result = await authService.login('validUser', 'validPassword');
		expect(result).toHaveProperty('user');
		expect(result.user).toHaveProperty('id');
	});

	test('should throw error for invalid credentials', async () => {
		await expect(authService.login('invalidUser', 'invalidPassword')).rejects.toThrow('Invalid credentials');
	});
});