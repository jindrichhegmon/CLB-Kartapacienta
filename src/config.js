/**
 * Konfigurace z .env. Spojení na PeceDomaPlus používá stejné názvy proměnných jako jhn-apps
 * (DB_PECEDOMAPLUS_*), takže na VPS stačí hodnoty převzít z /opt/jhn-apps/.env.
 */
import 'dotenv/config';

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
const bool = (v, d) => (v === '' ? d : /^(1|true|yes|ano)$/i.test(v));

export const config = {
  port: Number(env('PORT', '3120')),
  host: env('HOST', '127.0.0.1'),
  verejnaAdresa: env('KP_VEREJNA_ADRESA', 'https://kartapacienta.95-216-201-2.sslip.io'),
  db: {
    server: env('DB_PECEDOMAPLUS_SERVER', env('SQL_SERVER', '90.182.39.103')),
    port: Number(env('DB_PECEDOMAPLUS_PORT', env('SQL_PORT', '1433'))),
    database: env('DB_PECEDOMAPLUS_DATABASE', 'PeceDomaPlus'),
    user: env('DB_PECEDOMAPLUS_USER', 'pecedomaplus_app'),
    password: env('DB_PECEDOMAPLUS_PASSWORD'),
    encrypt: bool(env('SQL_ENCRYPT'), false),
    trustServerCertificate: bool(env('SQL_TRUST_CERT'), true),
  },
  // klíč k podpisu session, šifrování tajemství zařízení a prvních hesel (min. 32 znaků)
  secret: env('KP_SECRET'),
  // heslo do správy tenantů (superadmin provozovatele platformy)
  adminHeslo: env('KP_ADMIN_HESLO'),
  ai: {
    apiKey: env('ANTHROPIC_API_KEY'),
    model: env('KP_AI_MODEL', 'claude-sonnet-5-5'),
  },
  // SMS s odkazem na spárování telefonu s kartou (Twilio – stejné proměnné jako jhn-apps; účet + token, nebo API klíč + tajemství)
  sms: {
    ucet: env('TWILIO_ACCOUNT_SID'),
    token: env('TWILIO_AUTH_TOKEN'),
    klic: env('TWILIO_API_KEY_SID', env('TWILIO_API_KEY')),
    tajemstvi: env('TWILIO_API_KEY_SECRET', env('TWILIO_API_SECRET')),
    from: env('TWILIO_SMS_FROM', env('TWILIO_FROM')),
  },
  verze: '0.2.0',
};

export function zkontrolujKonfiguraci() {
  const chyby = [];
  if (!config.db.password) chyby.push('DB_PECEDOMAPLUS_PASSWORD');
  if (config.secret.length < 32) chyby.push('KP_SECRET (aspoň 32 znaků)');
  if (config.adminHeslo.length < 10) chyby.push('KP_ADMIN_HESLO (aspoň 10 znaků)');
  return chyby;
}
