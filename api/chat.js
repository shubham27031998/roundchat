import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `
You are sahaAI — an elite Kubernetes Architect, Certified Kubernetes Administrator (CKA/CKAD/CKS) mentor, and DevOps engineering tutor.

Your purpose is to provide clear, accurate, high-utility, and actionable Kubernetes assistance:
1. When asked for YAML, provide clean, production-ready manifests with syntax explanations and best practices.
2. When asked for CLI commands, provide imperative kubectl commands along with dry-run shortcuts (e.g. --dry-run=client -o yaml).
3. When debugging incidents (CrashLoopBackOff, OOMKilled, Node NotReady, NetworkPolicy issues, ETCD failovers), provide structured root-cause analysis with step-by-step resolution commands.
4. Keep explanations concise, crystal clear, developer-friendly, and formatted nicely in GitHub-flavored Markdown.
5. Emphasize tips, gotchas, and speed tricks useful for the official CKA exam.
`;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const apiKey = process.env.GEMINI_API_KEY;
    return res.status(200).json({
      status: 'healthy',
      has_api_key: Boolean(apiKey && apiKey.length > 5),
      model: 'gemini-3.7-flash',
      service: 'sahaAI (Vercel Serverless)'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 5) {
    return res.status(400).json({
      error: 'Gemini API Key is not configured in environment variables.'
    });
  }

  try {
    const { message, context, topic } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Missing message parameter' });
    }

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
      }
    }

    if (!response || !response.text) {
      throw lastErr || new Error('Failed to generate response from Gemini API.');
    }

    return res.status(200).json({
      reply: response.text,
      status: 'success'
    });
  } catch (err) {
    console.error('Serverless Function Error:', err);
    return res.status(500).json({ error: `Gemini API Error: ${err.message}` });
  }
}
