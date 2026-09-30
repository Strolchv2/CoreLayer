import { Router } from 'express';
import { listTemplates } from '../services/templates.js';

export const templatesRouter = Router();

/** Öffentlich: aktive Vorlagen (für Galerie und Editor). */
templatesRouter.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ templates: await listTemplates() });
});
