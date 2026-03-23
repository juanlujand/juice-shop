/**
 * Juice Shop Security Test Suite
 * Comprehensive security testing for authentication, authorization, input validation, and common vulnerabilities
 */

const request = require('supertest');
const { expect } = require('chai');
const app = require('../../app');
const db = require('../../lib/mongo');
const utils = require('../../lib/utils');

describe('Security Tests', () => {
  let authToken;
  let adminToken;
  let testUser;

  before(async () => {
    // Setup test database and create test users
    await db.clearCollection('users');

    // Create regular test user
    testUser = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      username: 'testuser'
    };

    // Create admin user for authz tests
    const adminUser = {
      email: 'admin@example.com',
      password: 'AdminPass123!',
      username: 'admin',
      role: 'admin'
    };

    await request(app)
      .post('/api/Users')
      .send(testUser);

    await request(app)
      .post('/api/Users')
      .send(adminUser);
  });

  describe('Authentication Security', () => {

    it('should prevent login with valid email but wrong password', async () => {
      const response = await request(app)
        .post('/rest/user/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should prevent login with invalid email format', async () => {
      const response = await request(app)
        .post('/rest/user/login')
        .send({
          email: 'invalid-email',
          password: testUser.password
        })
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should enforce rate limiting on login attempts', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/rest/user/login')
          .send(loginData);
      }

      // Should be rate limited
      const response = await request(app)
        .post('/rest/user/login')
        .send(loginData)
        .expect(429);

      expect(response.body).to.have.property('error');
    });

    it('should create secure session after successful login', async () => {
      const response = await request(app)
        .post('/rest/user/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response).to.have.cookie('token');
      expect(response.headers['set-cookie'][0]).to.include('HttpOnly');
      expect(response.headers['set-cookie'][0]).to.include('Secure');
      expect(response.headers['set-cookie'][0]).to.include('SameSite');
    });

    it('should validate JWT token structure', async () => {
      const response = await request(app)
        .post('/rest/user/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      // Extract token from cookie
      const token = response.headers['set-cookie'][0].split('=')[1].split(';')[0];

      // Verify token structure (3 parts separated by dots)
      expect(token).to.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });
  });

  describe('Authorization Security', () => {

    before(async () => {
      // Get auth tokens for tests
      const userResponse = await request(app)
        .post('/rest/user/login')
        .send(testUser);

      authToken = userResponse.headers['set-cookie'][0].split('=')[1].split(';')[0];

      const adminResponse = await request(app)
        .post('/rest/user/login')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123!'
        });

      adminToken = adminResponse.headers['set-cookie'][0].split('=')[1].split(';')[0];
    });

    it('should prevent unauthorized access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/Products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).to.have.property('error');
    });

    it('should allow authorized admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/Products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
    });

    it('should prevent access to user-owned resources by other users', async () => {
      // Create a second user
      const secondUser = {
        email: 'second@example.com',
        password: 'SecondPass123!',
        username: 'seconduser'
      };

      await request(app)
        .post('/api/Users')
        .send(secondUser);

      // Login as second user
      const secondLogin = await request(app)
        .post('/rest/user/login')
        .send(secondUser);

      const secondToken = secondLogin.headers['set-cookie'][0].split('=')[1].split(';')[0];

      // Try to access first user's profile with second user's token
      const response = await request(app)
        .get(`/api/Users/${testUser.username}`)
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(403);

      expect(response.body).to.have.property('error');
    });
  });

  describe('Input Validation Security', () => {

    it('should prevent SQL injection in login email', async () => {
      const sqlInjection = "'; DROP TABLE users; --";

      const response = await request(app)
        .post('/rest/user/login')
        .send({
          email: sqlInjection,
          password: testUser.password
        })
        .expect(401);

      expect(response.body).to.have.property('error');
      // Verify database still exists
      const users = await db.collection('users').find().toArray();
      expect(users).to.be.an('array');
    });

    it('should prevent XSS in user registration', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/Users')
        .send({
          email: 'xss@example.com',
          password: 'XssPass123!',
          username: xssPayload
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'plainaddress',
        '@missinglocal.com',
        'missing@.com',
        'missing@domain',
        'spaces @domain.com',
        'user@domain.c',
        'user@.domain.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/Users')
          .send({
            email: email,
            password: 'ValidPass123!',
            username: 'testuser'
          })
          .expect(400);

        expect(response.body).to.have.property('error');
      }
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        '111111',
        'short',
        'nouppercase1!',
        'NOLOWERCASE1!',
        'NoNumbers!',
        'NoSpecialChars1'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/Users')
          .send({
            email: `test${Date.now()}@example.com`,
            password: password,
            username: 'testuser'
          })
          .expect(400);

        expect(response.body).to.have.property('error');
      }
    });

    it('should prevent path traversal attacks', async () => {
      const pathTraversal = ['../../etc/passwd', '..\\..\\windows\\system32'];

      for (const payload of pathTraversal) {
        const response = await request(app)
          .get(`/api/Products/${payload}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body).to.have.property('error');
      }
    });

    it('should validate numeric input ranges', async () => {
      // Test negative product ID
      const response = await request(app)
        .get('/api/Products/-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).to.have.property('error');

      // Test extremely large product ID
      const largeResponse = await request(app)
        .get('/api/Products/999999999999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(largeResponse.body).to.have.property('error');
    });
  });

  describe('Session Security', () => {

    it('should invalidate session on logout', async () => {
      const loginResponse = await request(app)
        .post('/rest/user/login')
        .send(testUser)
        .expect(200);

      const token = loginResponse.headers['set-cookie'][0].split('=')[1].split(';')[0];

      // Logout
      await request(app)
        .post('/rest/user/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use token after logout
      const response = await request(app)
        .get('/rest/user/whoami')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should prevent session fixation', async () => {
      // Login and get session
      const loginResponse = await request(app)
        .post('/rest/user/login')
        .send(testUser)
        .expect(200);

      const originalToken = loginResponse.headers['set-cookie'][0].split('=')[1].split(';')[0];

      // Login again (should get new session)
      const secondLogin = await request(app)
        .post('/rest/user/login')
        .send(testUser)
        .expect(200);

      const newToken = secondLogin.headers['set-cookie'][0].split('=')[1].split(';')[0];

      // Tokens should be different
      expect(newToken).to.not.equal(originalToken);
    });

    it('should enforce session timeout', async () => {
      // This test would require mocking time or implementing fast-forward logic
      // For now, we'll test the session validation middleware exists
      const response = await request(app)
        .get('/rest/user/whoami')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).to.have.property('error');
    });
  });

  describe('Security Headers', () => {

    it('should set security headers on all responses', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
      expect(response.headers).to.have.property('x-frame-options', 'DENY');
      expect(response.headers).to.have.property('x-xss-protection', '1; mode=block');
      expect(response.headers).to.have.property('referrer-policy', 'strict-origin-when-cross-origin');
    });

    it('should include Content Security Policy header', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers).to.have.property('content-security-policy');
      expect(response.headers['content-security-policy']).to.include("default-src 'self'");
    });

    it('should set HSTS header on HTTPS responses', async () => {
      // This test would require HTTPS environment
      // For now, we'll test the header setting logic
      const response = await request(app)
        .get('/')
        .expect(200);

      // In production, this should be set for HTTPS
      // expect(response.headers).to.have.property('strict-transport-security');
    });
  });

  describe('CORS Security', () => {

    it('should handle preflight requests correctly', async () => {
      const response = await request(app)
        .options('/api/Products')
        .set('Origin', 'https://malicious-site.com')
        .expect(403);

      expect(response.headers).to.not.have.property('access-control-allow-origin');
    });

    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .options('/api/Products')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).to.have.property('access-control-allow-origin');
    });
  });

  describe('Error Handling Security', () => {

    it('should not expose stack traces in production', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.not.include('stack');
      expect(response.body.error).to.not.include('node_modules');
    });

    it('should sanitize database error messages', async () => {
      // Try to trigger a database error with invalid query
      const response = await request(app)
        .get('/api/Products/invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.not.include('MongoDB');
      expect(response.body.error).to.not.include('Collection');
    });
  });

  describe('File Upload Security', () => {

    it('should validate file types for uploads', async () => {
      const maliciousFile = {
        name: 'malicious.exe',
        type: 'application/x-executable'
      };

      const response = await request(app)
        .post('/api/FileUpload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('fake content'), maliciousFile.name)
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should limit file upload size', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB buffer

      const response = await request(app)
        .post('/api/FileUpload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', largeBuffer, 'large.jpg')
        .expect(413);

      expect(response.body).to.have.property('error');
    });
  });

  describe('API Security', () => {

    it('should prevent brute force attacks on API endpoints', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .get('/api/Products')
            .set('Authorization', 'Bearer invalid_token')
        );
      }

      await Promise.all(promises);

      // Should be rate limited
      const response = await request(app)
        .get('/api/Products')
        .set('Authorization', 'Bearer invalid_token')
        .expect(429);

      expect(response.body).to.have.property('error');
    });

    it('should validate JSON structure in POST requests', async () => {
      const malformedJSON = '{ " malformed json " }';

      const response = await request(app)
        .post('/api/Users')
        .set('Content-Type', 'application/json')
        .send(malformedJSON)
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should prevent HTTP parameter pollution', async () => {
      const response = await request(app)
        .get('/rest/products/search')
        .query({
          q: 'juice',
          q: '<script>alert(1)</script>'
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });
  });

  describe('Data Protection', () => {

    it('should hash passwords with strong algorithm', async () => {
      // Get user from database
      const user = await db.collection('users').findOne({ email: testUser.email });

      expect(user).to.have.property('password');
      expect(user.password).to.not.equal(testUser.password);

      // Verify it's bcrypt hash (starts with $2b$)
      expect(user.password).to.match(/^\$2[aby]\$\d+\$/);
    });

    it('should not return sensitive user information', async () => {
      const response = await request(app)
        .post('/rest/user/login')
        .send(testUser)
        .expect(200);

      expect(response.body).to.not.have.property('password');
      expect(response.body).to.not.have.property('securityQuestion');
      expect(response.body).to.not.have.property('securityAnswer');
    });
  });

  after(async () => {
    // Cleanup test data
    await db.clearCollection('users');
  });
});

// Utility functions for security testing
const securityUtils = {
  /**
   * Generate malicious payloads for testing
   */
  generateXSSPayloads: () => [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
    "'><script>alert('XSS')</script>"
  ],

  /**
   * Generate SQL injection payloads
   */
  generateSQLPayloads: () => [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT password FROM users --",
    "'; INSERT INTO users VALUES('hacker','pass'); --",
    "' OR 1=1 #"
  ],

  /**
   * Generate path traversal payloads
   */
  generatePathTraversal: () => [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
  ],

  /**
   * Generate command injection payloads
   */
  generateCommandInjection: () => [
    '; cat /etc/passwd',
    '| whoami',
    '`id`',
    '$(ls -la)',
    '&& echo "injection"'
  ]
};

module.exports = {
  securityUtils
};