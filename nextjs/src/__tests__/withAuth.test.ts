/**
 * Tests for withAuth utility
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withAuthPages } from '../server/withAuth';

describe('withAuth', () => {
  const validToken = createTestToken({
    userId: 'user123',
    email: 'test@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  });

  describe('App Router withAuth', () => {
    it('should call handler with session and apiKey when authenticated', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withAuth(mockHandler);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          cookie: `ainative_token=${validToken}`,
        },
      });

      await wrappedHandler(req);

      expect(mockHandler).toHaveBeenCalledWith(req, {
        session: expect.objectContaining({
          userId: 'user123',
          email: 'test@example.com',
        }),
        apiKey: validToken,
        params: undefined,
      });
    });

    it('should return 401 when no cookie present', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);

      const req = new NextRequest('http://localhost:3000/api/test');
      const response = await wrappedHandler(req);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = createTestToken({
        userId: 'user123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 3600,
        iat: Math.floor(Date.now() / 1000) - 7200,
      });

      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          cookie: `ainative_token=${expiredToken}`,
        },
      });

      const response = await wrappedHandler(req);
      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should support custom cookie name', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withAuth(mockHandler, { cookieName: 'custom_token' });

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          cookie: `custom_token=${validToken}`,
        },
      });

      await wrappedHandler(req);

      expect(mockHandler).toHaveBeenCalledWith(req, expect.objectContaining({
        session: expect.objectContaining({ userId: 'user123' }),
        apiKey: validToken,
      }));
    });

    it('should pass params to handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withAuth(mockHandler);

      const req = new NextRequest('http://localhost:3000/api/test');
      req.headers.set('cookie', `ainative_token=${validToken}`);

      const context = { params: { id: '123' } };
      await wrappedHandler(req, context);

      expect(mockHandler).toHaveBeenCalledWith(req, expect.objectContaining({
        params: { id: '123' },
      }));
    });

    it('should handle handler errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withAuth(mockHandler);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          cookie: `ainative_token=${validToken}`,
        },
      });

      const response = await wrappedHandler(req);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
    });
  });

  describe('Pages Router withAuthPages', () => {
    it('should call handler with session and apiKey when authenticated', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuthPages(mockHandler);

      const req = {
        headers: {
          cookie: `ainative_token=${validToken}`,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await wrappedHandler(req, res);

      expect(mockHandler).toHaveBeenCalledWith(req, res, {
        session: expect.objectContaining({
          userId: 'user123',
          email: 'test@example.com',
        }),
        apiKey: validToken,
      });

      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when no cookie present', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuthPages(mockHandler);

      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await wrappedHandler(req, res);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = createTestToken({
        userId: 'user123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 3600,
        iat: Math.floor(Date.now() / 1000) - 7200,
      });

      const mockHandler = jest.fn();
      const wrappedHandler = withAuthPages(mockHandler);

      const req = {
        headers: {
          cookie: `ainative_token=${expiredToken}`,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await wrappedHandler(req, res);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should support custom cookie name', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuthPages(mockHandler, { cookieName: 'custom_token' });

      const req = {
        headers: {
          cookie: `custom_token=${validToken}`,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await wrappedHandler(req, res);

      expect(mockHandler).toHaveBeenCalledWith(req, res, expect.objectContaining({
        session: expect.objectContaining({ userId: 'user123' }),
        apiKey: validToken,
      }));
    });

    it('should handle handler errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withAuthPages(mockHandler);

      const req = {
        headers: {
          cookie: `ainative_token=${validToken}`,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await wrappedHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
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
