/**
 * Konfigurace z .env. Spojení na PeceDomaPlus používá stejné názvy proměnných jako jhn-apps
 * (DB_PECEDOMAPLUS_*), takže na VPS stačí hodnoty převzít z /opt/jhn-apps/.env.
 */
import 'dotenv/config';
import fs from 'node:fs';
import dotenv from 'dotenv';

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
// Twilio pro SMS: když v .env karty chybí, převezme se ze sdíleného .env jhn-apps na stejném VPS (stejné názvy proměnných)
const jhnApps = (() => { try { return dotenv.parse(fs.readFileSync(process.env.JHN_APPS_ENV || '/opt/jhn-apps/.env')); } catch { return {}; } })();
const tw = (...k) => { for (const x of k) { const v = env(x) || String(jhnApps[x] ?? '').trim(); if (v) return v; } return ''; };
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
    ucet: tw('TWILIO_ACCOUNT_SID'),
    token: tw('TWILIO_AUTH_TOKEN'),
    klic: tw('TWILIO_API_KEY_SID', 'TWILIO_API_KEY'),
    tajemstvi: tw('TWILIO_API_KEY_SECRET', 'TWILIO_API_SECRET'),
    from: tw('TWILIO_SMS_FROM', 'TWILIO_FROM') || '+420736354150',   // odesílací číslo jako v jhn-apps
  },
  // klíč pro partnerské API (/api/partner/* – PéčeDoma na stejném VPS si bere kód lékaře dne); prázdné = API vypnuté
  partnerKlic: env('KP_PARTNER_KLIC'),
  verze: '0.11.42',
};

export function zkontrolujKonfiguraci() {
  const chyby = [];
  if (!config.db.password) chyby.push('DB_PECEDOMAPLUS_PASSWORD');
  if (config.secret.length < 32) chyby.push('KP_SECRET (aspoň 32 znaků)');
  if (config.adminHeslo.length < 10) chyby.push('KP_ADMIN_HESLO (aspoň 10 znaků)');
  return chyby;
}
