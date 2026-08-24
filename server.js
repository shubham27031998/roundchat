import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const SYSTEM_INSTRUCTION = `
You are the Roundchat K8s & CKA AI Copilot — an elite Kubernetes Architect, Certified Kubernetes Administrator (CKA/CKAD/CKS) mentor, and DevOps engineering tutor.

Your purpose is to provide clear, accurate, high-utility, and actionable Kubernetes assistance:
1. When asked for YAML, provide clean, production-ready manifests with syntax explanations and best practices.
2. When asked for CLI commands, provide imperative kubectl commands along with dry-run shortcuts (e.g. --dry-run=client -o yaml).
3. When debugging incidents (CrashLoopBackOff, OOMKilled, Node NotReady, NetworkPolicy issues, ETCD failovers), provide structured root-cause analysis with step-by-step resolution commands.
4. Keep explanations concise, crystal clear, developer-friendly, and formatted nicely in GitHub-flavored Markdown.
5. Emphasize tips, gotchas, and speed tricks useful for the official CKA exam.
`;

app.get('/api/health', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  res.json({
    status: 'healthy',
    has_api_key: Boolean(apiKey && apiKey.length > 5),
    model: 'gemini-2.5-flash',
    service: 'Roundchat K8s AI Copilot'
  });
});

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 5) {
    return res.status(400).json({
      error: 'Gemini API Key is not configured on the server. Please set GEMINI_API_KEY in .env.'
    });
  }

  try {
    const { message, context, topic } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const promptParts = [];
    if (topic) promptParts.push(`[Topic Context: ${topic}]`);
    if (context) promptParts.push(`[Context / Reference Data:\n${context}\n]`);
    promptParts.push(message);

    const fullPrompt = promptParts.join('\n\n');

    const candidateModels = ['gemini-3.7-flash', 'gemini-3.5-flash-lite'];
    let response = null;
    let lastErr = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3
          }
        });
        if (response && response.text) break;
      } catch (err) {
        lastErr = err;
        console.warn(`Model ${modelName} error, trying fallback...`, err.message);
      }
    }

    if (!response || !response.text) {
      throw lastErr || new Error('Failed to generate response from Gemini API.');
    }

    res.json({
      reply: response.text,
      status: 'success'
    });
  } catch (err) {
    console.error('Gemini API Error:', err);
    res.status(500).json({ error: `Gemini API Error: ${err.message}` });
  }
});

app.post('/api/game/hint', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 5) {
    return res.status(400).json({ error: 'Gemini API Key missing.' });
  }
  try {
    const { title, desc } = req.body;
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `For the Kubernetes troubleshooting scenario '${title}: ${desc}', give ONE brief, clever hint (maximum 1 sentence) to guide the student towards finding the solution, without directly giving the exact answer away.`;
    for (const modelName of ['gemini-3.7-flash', 'gemini-3.5-flash-lite']) {
      try {
        const response = await ai.models.generateContent({ model: modelName, contents: prompt });
        if (response && response.text) {
          return res.json({ hint: response.text.trim(), status: 'success' });
        }
      } catch (e) {}
    }
    throw new Error('Unable to generate hint.');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/game/scenario', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 5) {
    return res.status(400).json({ error: 'Gemini API Key missing.' });
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Generate a realistic, unique CKA Kubernetes cluster incident challenge.
Return ONLY a valid JSON object without markdown fences, with these exact keys:
{
  "title": "Incident Name",
  "desc": "Detailed problem description with realistic error symptom or logs",
  "options": ["Option 1 (command or YAML snippet)", "Option 2", "Option 3", "Option 4"],
  "correct": 0,
  "explanation": "Why this option is correct and how it resolves the failure"
}`;
    for (const modelName of ['gemini-3.7-flash', 'gemini-3.5-flash-lite']) {
      try {
        const response = await ai.models.generateContent({ model: modelName, contents: prompt });
        if (response && response.text) {
          let clean = response.text.trim();
          if (clean.startsWith('```json')) clean = clean.substring(7);
          if (clean.startsWith('```')) clean = clean.substring(3);
          if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
          const data = JSON.parse(clean.trim());
          return res.json({ scenario: data, status: 'success' });
        }
      } catch (e) {}
    }
    throw new Error('Failed to generate scenario.');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Roundchat K8s AI Server running on http://localhost:${PORT}`);
});
