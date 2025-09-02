const generateToken = require('../../../utils/generateToken');

test('should generate a valid token', () => {
	const token = generateToken('user123');
	expect(token).toBeDefined();
	expect(typeof token).toBe('string');
	expect(token.length).toBeGreaterThan(0);
});

test('should generate different tokens for different inputs', () => {
	const token1 = generateToken('user123');
	const token2 = generateToken('user456');
	expect(token1).not.toEqual(token2);
});

test('should throw an error for invalid input', () => {
	expect(() => generateToken(null)).toThrow('Invalid input');
	expect(() => generateToken('')).toThrow('Invalid input');
});