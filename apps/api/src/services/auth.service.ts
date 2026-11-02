import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepo } from '../repositories';
import { AppError } from '../utils/errors';

export interface AccessClaims {
  sub: string;
  role: 'admin' | 'editor';
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
// A real bcrypt hash used when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function signAccessToken(user: { id: string; role: 'admin' | 'editor' }) {
  return jwt.sign({ role: user.role } satisfies Omit<AccessClaims, 'sub'>, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    issuer: 'sda-api',
    audience: 'sda-admin',
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'sda-api', audience: 'sda-admin' }) as jwt.JwtPayload;
    return { sub: String(payload.sub), role: payload.role };
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
  }
}

function newRefreshToken() {
  const raw = randomBytes(48).toString('base64url');
  return { raw, hash: sha256(raw), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000) };
}

const publicUser = (u: { _id: unknown; email: string; name: string; role: 'admin' | 'editor' }) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role });

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepo.findByEmailWithSecrets(email);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    const refresh = newRefreshToken();
    await userRepo.rotateRefreshToken(user._id, null, { hash: refresh.hash, expiresAt: refresh.expiresAt });
    const pub = publicUser(user);
    return { user: pub, accessToken: signAccessToken(pub), refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt };
  },

  /** Exchanges a refresh token for a new access token AND a new refresh token (rotation). */
  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new AppError(401, 'NO_REFRESH_TOKEN', 'Not signed in');
    const hash = sha256(rawToken);
    const user = await userRepo.findByRefreshHash(hash);
    const stored = user?.refreshTokens.find((t) => t.hash === hash);
    if (!user || !stored || stored.expiresAt < new Date()) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired, please sign in again');
    const next = newRefreshToken();
    await userRepo.rotateRefreshToken(user._id, hash, { hash: next.hash, expiresAt: next.expiresAt });
    const pub = publicUser(user);
    return { user: pub, accessToken: signAccessToken(pub), refreshToken: next.raw, refreshExpiresAt: next.expiresAt };
  },

  async logout(rawToken: string | undefined) {
    if (rawToken) await userRepo.removeRefreshToken(sha256(rawToken));
  },

  async me(userId: string) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError(401, 'INVALID_TOKEN', 'User no longer exists');
    return publicUser(user);
  },

  hashPassword: (password: string) => bcrypt.hash(password, 12),
};
