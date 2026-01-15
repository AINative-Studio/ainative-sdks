/**
 * Tests for getSession utility
 */

import { getSession, getSessionFromCookie, getApiKey, getApiKeyFromCookie } from '../server/getSession';

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

const { cookies } = require('next/headers');

describe('getSession', () => {
  describe('getSession (App Router)', () => {
    const validToken = createTestToken({
      userId: 'user123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return session from valid cookie', async () => {
      cookies.mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: validToken }),
      });

      const session = await getSession();

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user123');
      expect(session?.email).toBe('test@example.com');
    });

    it('should return null when cookie not found', async () => {
      cookies.mockResolvedValue({
        get: jest.fn().mockReturnValue(undefined),
      });

      const session = await getSession();
      expect(session).toBeNull();
    });

    it('should support custom cookie name', async () => {
      const mockGet = jest.fn().mockReturnValue({ value: validToken });
      cookies.mockResolvedValue({
        get: mockGet,
      });

      const session = await getSession('custom_token');
      expect(session).not.toBeNull();
      expect(mockGet).toHaveBeenCalledWith('custom_token');
    });

    it('should handle errors gracefully', async () => {
      cookies.mockRejectedValue(new Error('Cookie error'));

      const session = await getSession();
      expect(session).toBeNull();
    });
  });

  describe('getApiKey (App Router)', () => {
    const testToken = 'test.jwt.token';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return API key from cookie', async () => {
      cookies.mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: testToken }),
      });

      const apiKey = await getApiKey();
      expect(apiKey).toBe(testToken);
    });

    it('should return null when cookie not found', async () => {
      cookies.mockResolvedValue({
        get: jest.fn().mockReturnValue(undefined),
      });

      const apiKey = await getApiKey();
      expect(apiKey).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      cookies.mockRejectedValue(new Error('Cookie error'));

      const apiKey = await getApiKey();
      expect(apiKey).toBeNull();
    });
  });

  describe('getSessionFromCookie', () => {
    const validToken = createTestToken({
      userId: 'user123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
    });

    it('should return session from valid cookie', () => {
      const cookieHeader = `ainative_token=${validToken}`;
      const session = getSessionFromCookie(cookieHeader);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user123');
      expect(session?.email).toBe('test@example.com');
    });

    it('should return null for undefined cookie header', () => {
      const session = getSessionFromCookie(undefined);
      expect(session).toBeNull();
    });

    it('should return null for empty cookie header', () => {
      const session = getSessionFromCookie('');
      expect(session).toBeNull();
    });

    it('should return null when cookie not found', () => {
      const cookieHeader = 'other_cookie=value';
      const session = getSessionFromCookie(cookieHeader);
      expect(session).toBeNull();
    });

    it('should handle multiple cookies', () => {
      const cookieHeader = `other_cookie=value; ainative_token=${validToken}; another=value`;
      const session = getSessionFromCookie(cookieHeader);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user123');
    });

    it('should support custom cookie name', () => {
      const cookieHeader = `custom_token=${validToken}`;
      const session = getSessionFromCookie(cookieHeader, 'custom_token');

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user123');
    });

    it('should return null for expired token', () => {
      const expiredToken = createTestToken({
        userId: 'user123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
      });

      const cookieHeader = `ainative_token=${expiredToken}`;
      const session = getSessionFromCookie(cookieHeader);
      expect(session).toBeNull();
    });

    it('should return null for malformed token', () => {
      const cookieHeader = 'ainative_token=invalid.token';
      const session = getSessionFromCookie(cookieHeader);
      expect(session).toBeNull();
    });

    it('should return null for token missing required fields', () => {
      const incompleteToken = createTestToken({
        userId: 'user123',
        // missing email, exp, iat
      });

      const cookieHeader = `ainative_token=${incompleteToken}`;
      const session = getSessionFromCookie(cookieHeader);
      expect(session).toBeNull();
    });
  });

  describe('getApiKeyFromCookie', () => {
    const testToken = 'test.jwt.token';

    it('should return API key from cookie', () => {
      const cookieHeader = `ainative_token=${testToken}`;
      const apiKey = getApiKeyFromCookie(cookieHeader);
      expect(apiKey).toBe(testToken);
    });

    it('should return null for undefined cookie header', () => {
      const apiKey = getApiKeyFromCookie(undefined);
      expect(apiKey).toBeNull();
    });

    it('should return null for empty cookie header', () => {
      const apiKey = getApiKeyFromCookie('');
      expect(apiKey).toBeNull();
    });

    it('should return null when cookie not found', () => {
      const cookieHeader = 'other_cookie=value';
      const apiKey = getApiKeyFromCookie(cookieHeader);
      expect(apiKey).toBeNull();
    });

    it('should handle multiple cookies', () => {
      const cookieHeader = `other_cookie=value; ainative_token=${testToken}; another=value`;
      const apiKey = getApiKeyFromCookie(cookieHeader);
      expect(apiKey).toBe(testToken);
    });

    it('should support custom cookie name', () => {
      const cookieHeader = `custom_token=${testToken}`;
      const apiKey = getApiKeyFromCookie(cookieHeader, 'custom_token');
      expect(apiKey).toBe(testToken);
    });
  });
});

/**
 * Helper to create test JWT tokens
 */
function createTestToken(payload: any): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'test_signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
