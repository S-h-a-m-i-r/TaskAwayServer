#!/usr/bin/env node

/**
 * Manual Test Script for Forgot Password Functionality
 * 
 * This script tests the actual forgot password flow with real API calls.
 * Make sure your server is running before executing this script.
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test configuration
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

class ForgotPasswordTester {
  constructor() {
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${API_BASE}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      return { status: 500, data: { error: error.message } };
    }
  }

  async testEmailConfiguration() {
    this.log('Testing email configuration...');
    
    const result = await this.makeRequest('/auth/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: TEST_EMAIL })
    });

    if (result.status === 200) {
      this.log('✅ Email configuration is working correctly', 'success');
      this.testResults.push({ test: 'Email Configuration', status: 'PASS' });
    } else {
      this.log(`❌ Email configuration failed: ${result.data.error || result.data.message}`, 'error');
      this.testResults.push({ test: 'Email Configuration', status: 'FAIL', error: result.data.error });
    }
  }

  async testForgotPassword() {
    this.log('Testing forgot password request...');
    
    const result = await this.makeRequest('/auth/forget-password', {
      method: 'POST',
      body: JSON.stringify({ email: TEST_EMAIL })
    });

    if (result.status === 200) {
      this.log('✅ Forgot password request successful', 'success');
      this.testResults.push({ test: 'Forgot Password Request', status: 'PASS' });
      return true;
    } else {
      this.log(`❌ Forgot password request failed: ${result.data.message}`, 'error');
      this.testResults.push({ test: 'Forgot Password Request', status: 'FAIL', error: result.data.message });
      return false;
    }
  }

  async testResetPassword(token, userId) {
    this.log('Testing password reset...');
    
    const newPassword = 'NewPassword123!';
    const result = await this.makeRequest(`/auth/reset-password?token=${token}&id=${userId}`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword })
    });

    if (result.status === 200) {
      this.log('✅ Password reset successful', 'success');
      this.testResults.push({ test: 'Password Reset', status: 'PASS' });
      return true;
    } else {
      this.log(`❌ Password reset failed: ${result.data.message || result.data.error}`, 'error');
      this.testResults.push({ test: 'Password Reset', status: 'FAIL', error: result.data.message || result.data.error });
      return false;
    }
  }

  async testWeakPassword(token, userId) {
    this.log('Testing weak password validation...');
    
    const weakPasswords = [
      '123', // too short
      'newpassword', // no uppercase, no number
      'NEWPASSWORD', // no lowercase, no number
      'NewPassword' // no number
    ];

    for (const weakPassword of weakPasswords) {
      const result = await this.makeRequest(`/auth/reset-password?token=${token}&id=${userId}`, {
        method: 'POST',
        body: JSON.stringify({ new_password: weakPassword })
      });

      if (result.status === 400) {
        this.log(`✅ Weak password "${weakPassword}" properly rejected`, 'success');
      } else {
        this.log(`❌ Weak password "${weakPassword}" not properly rejected`, 'error');
        this.testResults.push({ test: 'Weak Password Validation', status: 'FAIL', error: `Password "${weakPassword}" should have been rejected` });
        return false;
      }
    }

    this.testResults.push({ test: 'Weak Password Validation', status: 'PASS' });
    return true;
  }

  async testInvalidEmail() {
    this.log('Testing invalid email format...');
    
    const result = await this.makeRequest('/auth/forget-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email' })
    });

    if (result.status === 400) {
      this.log('✅ Invalid email properly rejected', 'success');
      this.testResults.push({ test: 'Invalid Email Validation', status: 'PASS' });
    } else {
      this.log(`❌ Invalid email not properly handled: ${result.status}`, 'error');
      this.testResults.push({ test: 'Invalid Email Validation', status: 'FAIL' });
    }
  }

  async testNonExistentEmail() {
    this.log('Testing non-existent email...');
    
    const result = await this.makeRequest('/auth/forget-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@example.com' })
    });

    if (result.status === 404) {
      this.log('✅ Non-existent email properly handled', 'success');
      this.testResults.push({ test: 'Non-existent Email', status: 'PASS' });
    } else {
      this.log(`❌ Non-existent email not properly handled: ${result.status}`, 'error');
      this.testResults.push({ test: 'Non-existent Email', status: 'FAIL' });
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Forgot Password & Reset Password Manual Tests');
    this.log(`📍 Testing against: ${BASE_URL}`);
    this.log(`📧 Test email: ${TEST_EMAIL}`);
    this.log('');

    // Test email configuration first
    await this.testEmailConfiguration();
    this.log('');

    // Test invalid email format
    await this.testInvalidEmail();
    this.log('');

    // Test non-existent email
    await this.testNonExistentEmail();
    this.log('');

    // Test valid forgot password request
    const forgotPasswordSuccess = await this.testForgotPassword();
    this.log('');

    // If forgot password worked, test reset password (you'll need to provide token and user ID)
    if (forgotPasswordSuccess) {
      this.log('💡 To test password reset, you need to:');
      this.log('1. Check your email for the reset link');
      this.log('2. Extract the token and user ID from the link');
      this.log('3. Run: node tests/manual-test.js --reset <token> <userId>');
      this.log('');
    }

    // Check if reset password test was requested
    const resetIndex = process.argv.indexOf('--reset');
    if (resetIndex !== -1 && process.argv[resetIndex + 1] && process.argv[resetIndex + 2]) {
      const token = process.argv[resetIndex + 1];
      const userId = process.argv[resetIndex + 2];
      
      this.log('🔄 Testing password reset functionality...');
      await this.testResetPassword(token, userId);
      this.log('');
      
      this.log('🔒 Testing weak password validation...');
      await this.testWeakPassword(token, userId);
      this.log('');
    }

    // Print summary
    this.printSummary();

    if (forgotPasswordSuccess) {
      this.log('');
      this.log('💡 Next Steps:');
      this.log('1. Check your email for the reset link');
      this.log('2. Extract token and user ID from the link');
      this.log('3. Run: node tests/manual-test.js --reset <token> <userId>');
      this.log('4. Verify the new password works');
    }
  }

  printSummary() {
    this.log('📊 Test Summary:');
    this.log('================');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      this.log(`${icon} ${result.test}: ${result.status}`);
      if (result.error) {
        this.log(`   Error: ${result.error}`);
      }
    });
    
    this.log('');
    this.log(`📈 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      this.log('🎉 All tests passed!', 'success');
    } else {
      this.log('⚠️  Some tests failed. Check the errors above.', 'error');
    }
  }
}

// Run the tests
async function main() {
  const tester = new ForgotPasswordTester();
  await tester.runAllTests();
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Manual Test Script for Forgot Password

Usage:
  node tests/manual-test.js [options]

Options:
  --email <email>     Test email address (default: test@example.com)
  --url <url>         Base URL for API (default: http://localhost:3000)
  --reset <token> <userId>  Test password reset with token and user ID
  --help, -h          Show this help message

Environment Variables:
  TEST_EMAIL          Test email address
  BASE_URL            Base URL for API

Examples:
  node tests/manual-test.js --email user@example.com
  TEST_EMAIL=user@example.com node tests/manual-test.js
  `);
  process.exit(0);
}

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && args[i + 1]) {
    process.env.TEST_EMAIL = args[i + 1];
    i++;
  } else if (args[i] === '--url' && args[i + 1]) {
    process.env.BASE_URL = args[i + 1];
    i++;
  }
}

main().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
}); 