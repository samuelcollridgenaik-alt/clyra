import 'dotenv/config';
const raw = process.env;
export const config = {
  production: raw.NODE_ENV === 'production',
  port: Number(raw.PORT || 4000),
  mongoUri: raw.MONGODB_URI || 'mongodb://127.0.0.1:27017/clyra_db',
  jwtSecret: raw.JWT_ACCESS_SECRET,
  issuer: raw.JWT_ISSUER || 'clyra-api',
  audience: raw.JWT_AUDIENCE || 'clyra-clients',
  corsOrigins: (raw.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x=>x.trim()),
  studentRegistration: raw.ALLOW_STUDENT_REGISTRATION === 'true',
  studentDomain: raw.STUDENT_EMAIL_DOMAIN?.trim().toLowerCase() || '',
  textOnlyResolution: raw.NODE_ENV !== 'production' && raw.ALLOW_TEXT_ONLY_RESOLUTION === 'true',
  aiUrl: raw.AI_BASE_URL || 'http://127.0.0.1:8000',
  aiSecret: raw.AI_SHARED_SECRET || '',
};
export function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret.length < 32 || config.jwtSecret.includes('replace-with')) {
    throw new Error('Configure a strong JWT_ACCESS_SECRET in .env before starting the API');
  }
  if (config.production && (!config.aiSecret || config.aiSecret.includes('replace-with'))) {
    throw new Error('Configure an independent AI_SHARED_SECRET for production');
  }
}
