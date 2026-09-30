import { describe, expect, it } from 'vitest';
import { readLatestOutboxMail } from '../src/services/mail.js';
import { createClient, getApp, registerUser } from './helpers.js';
import request from 'supertest';

describe('Authentifizierung', () => {
  it('registriert, liefert /me, meldet ab und wieder an', async () => {
    const { client, email, password } = await registerUser('auth');
    const me = await client.get('/api/auth/me');
    expect(me.body.user.email).toBe(email);
    expect(me.body.user).not.toHaveProperty('passwordHash');

    await client.post('/api/auth/logout').expect(200);
    expect((await client.get('/api/auth/me')).body.user).toBeNull();

    await client.post('/api/auth/login', { email, password: 'falsches-Passwort-9' }).expect(401);
    const login = await client.post('/api/auth/login', { email: email.toUpperCase(), password });
    expect(login.status).toBe(200);
    expect((await client.get('/api/auth/me')).body.user.email).toBe(email);
  });

  it('setzt ein httpOnly-Session-Cookie mit SameSite', async () => {
    const client = await createClient();
    const res = await client.post('/api/auth/register', { email: `cookie${Date.now()}@example.com`, password: 'sicheres-Passwort-1', acceptTerms: true });
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('cvs_session='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('verhindert doppelte Registrierung und schwache Passwörter', async () => {
    const { email } = await registerUser('dup');
    const client = await createClient();
    expect((await client.post('/api/auth/register', { email, password: 'sicheres-Passwort-1', acceptTerms: true })).body.error.code).toBe('email_taken');
    const weak = await client.post('/api/auth/register', { email: `weak${Date.now()}@example.com`, password: 'kurz', acceptTerms: true });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBe('password_too_short');
  });

  it('lehnt verändernde Anfragen ohne CSRF-Token ab', async () => {
    const app = await getApp();
    const res = await request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'y' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_invalid');
  });

  it('setzt das Passwort per E-Mail-Link zurück und beendet alte Sessions', async () => {
    const { client, email } = await registerUser('reset');
    const other = await createClient();
    await other.post('/api/auth/forgot-password', { email }).expect(200);
    // Unbekannte Adresse: gleiche Antwort (keine Konto-Enumeration)
    await other.post('/api/auth/forgot-password', { email: 'unbekannt@example.com' }).expect(200);
    const mail = await readLatestOutboxMail();
    expect(mail?.to).toBe(email);
    const token = decodeURIComponent(mail!.text.match(/token=([^\s]+)/)![1]!);
    await other.post('/api/auth/reset-password', { token, password: 'neues-Passwort-22' }).expect(200);
    // Token ist nur einmal gültig
    expect((await other.post('/api/auth/reset-password', { token, password: 'neues-Passwort-33' })).body.error.code).toBe('reset_token_invalid');
    // Alte Session ist beendet
    expect((await client.get('/api/auth/me')).body.user).toBeNull();
    await other.post('/api/auth/login', { email, password: 'neues-Passwort-22' }).expect(200);
  });

  it('sperrt das Konto nach zu vielen Fehlversuchen vorübergehend', async () => {
    const { email, password } = await registerUser('lock');
    const client = await createClient();
    for (let i = 0; i < 10; i++) await client.post('/api/auth/login', { email, password: 'falsches-Passwort-1' });
    const res = await client.post('/api/auth/login', { email, password });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('account_locked');
  });

  it('schützt geschützte Routen', async () => {
    const client = await createClient();
    expect((await client.get('/api/resumes')).status).toBe(401);
    expect((await client.get('/api/admin/stats')).status).toBe(401);
    const { client: user } = await registerUser('noadmin');
    expect((await user.get('/api/admin/stats')).status).toBe(403);
  });
});
