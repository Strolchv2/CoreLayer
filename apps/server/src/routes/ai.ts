import { AI_ACTIONS, LOCALES, type AiSuggestionDTO } from '@cv-studio/shared';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { audit } from '../services/audit.js';
import { suggestRewrite } from '../services/ai.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.get('/status', (_req, res) => {
  res.json({ enabled: config.ai.enabled });
});

const schema = z.object({
  text: z.string().trim().min(3).max(6000),
  action: z.enum(AI_ACTIONS),
  context: z.enum(['summary', 'experience', 'bullets', 'cover_letter', 'generic']).default('generic'),
  language: z.enum(LOCALES).default('de'),
});

/** Liefert einen Vorschlag – übernommen wird er ausschließlich durch den Benutzer im Frontend. */
aiRouter.post('/rewrite', aiLimiter, async (req, res) => {
  const user = currentUser(req);
  const input = parse(schema, req.body);
  const suggestion = await suggestRewrite(input);
  await audit(user.id, 'ai.rewrite', { action: input.action, context: input.context });
  const body: AiSuggestionDTO = { original: input.text, suggestion, action: input.action };
  res.json(body);
});
