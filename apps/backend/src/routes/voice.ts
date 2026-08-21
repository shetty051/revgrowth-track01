import { Router } from 'express';
import { processVoiceCommand, currentGuardrailConfig } from '../services/voice';

export const voiceRouter = Router();

// POST /api/voice/command — Process voice command transcription
voiceRouter.post('/command', async (req, res) => {
  try {
    const { transcription } = req.body;
    if (!transcription) {
      return res.status(400).json({ error: 'transcription text is required' });
    }

    const result = await processVoiceCommand(transcription);
    res.json(result);
  } catch (error) {
    console.error('Error processing voice command:', error);
    res.status(500).json({ error: 'Failed to process voice command' });
  }
});

// GET /api/voice/guardrails — Fetch current guardrail configuration
voiceRouter.get('/guardrails', (_req, res) => {
  res.json({ guardrailConfig: currentGuardrailConfig });
});