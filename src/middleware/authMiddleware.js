const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let jwksCache = null;
let jwksCacheExpiry = 0;

const getJwks = async (clientUrl) => {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }

  const jwksUrl = `${clientUrl}/api/auth/jwks`;
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: ${response.statusText}`);
  }
  const data = await response.json();
  jwksCache = data.keys || [];
  jwksCacheExpiry = now + 10 * 60 * 1000; // Cache for 10 minutes
  return jwksCache;
};

const protect = async (req, res, next) => {
  let token;

  // Check Authorization header first
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else {
    // Fallback to cookie
    token = req.cookies['better-auth.session_token'] || req.cookies['__Secure-better-auth.session_token'];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  const isJwt = token.includes('.');

  if (isJwt) {
    try {
      // Decode JWT header to extract key ID (kid)
      const decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken || !decodedToken.header) {
        return res.status(401).json({ success: false, message: 'Not authorized, invalid token structure' });
      }

      const kid = decodedToken.header.kid;
      if (!kid) {
        return res.status(401).json({ success: false, message: 'Not authorized, token missing key ID' });
      }

      // Fetch JWKS keys from Next.js Auth Server
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
      let keys = await getJwks(clientUrl);
      let jwk = keys.find(k => k.kid === kid);

      if (!jwk) {
        // Clear cache and try fetching again once to handle key rotation
        jwksCache = null;
        keys = await getJwks(clientUrl);
        jwk = keys.find(k => k.kid === kid);
      }

      if (!jwk) {
        return res.status(401).json({ success: false, message: 'Not authorized, signature key not found' });
      }

      // Convert JWK to PEM public key
      const keyObject = crypto.createPublicKey({
        key: jwk,
        format: 'jwk'
      });
      const publicKeyPem = keyObject.export({
        type: 'spki',
        format: 'pem'
      });

      // Verify the signature
      const decodedPayload = jwt.verify(token, publicKeyPem, {
        algorithms: [jwk.alg || 'RS256']
      });

      const userPayload = decodedPayload.user || decodedPayload;
      const userId = userPayload.id || userPayload.sub;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authorized, invalid token payload' });
      }

      let userObjectId = null;
      try {
        if (ObjectId.isValid(userId)) {
          userObjectId = new ObjectId(userId);
        }
      } catch (e) {
        // ignore conversion error
      }

      req.user = {
        _id: userObjectId,
        id: userId,
        name: userPayload.name,
        email: userPayload.email,
        photoURL: userPayload.image || userPayload.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150"
      };

      return next();
    } catch (error) {
      console.error("JWT Auth verification error:", error);
      return res.status(401).json({ success: false, message: 'Not authorized, token verification failed' });
    }
  } else {
    // Fallback: Existing database-backed session verification
    try {
      // Connect to the shared MongoDB 'sessions' collection
      const session = await mongoose.connection.db
        .collection('sessions')
        .findOne({ token });

      if (!session) {
        return res.status(401).json({ success: false, message: 'Not authorized, session not found' });
      }

      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({ success: false, message: 'Not authorized, session expired' });
      }

      // Retrieve the user from 'users' collection
      let dbUser = await mongoose.connection.db
        .collection('users')
        .findOne({ _id: session.userId });

      if (!dbUser) {
        // Try casting userId to ObjectId in case it's stored as an ObjectId
        try {
          dbUser = await mongoose.connection.db
            .collection('users')
            .findOne({ _id: new ObjectId(session.userId) });
        } catch (e) {
          // ignore cast error
        }
      }

      if (!dbUser) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Attach user to req.user, mapping _id to id and bridging photoURL / image
      req.user = {
        _id: dbUser._id,
        id: dbUser._id.toString(),
        name: dbUser.name,
        email: dbUser.email,
        photoURL: dbUser.image || dbUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150"
      };

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ success: false, message: 'Authorization error' });
    }
  }
};

module.exports = { protect };


