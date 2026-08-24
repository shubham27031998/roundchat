import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 5) {
    return res.status(400).json({ error: 'Gemini API Key missing.' });
  }

  const { action, title, desc } = req.body || {};
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (action === 'hint') {
      const prompt = `For the Kubernetes troubleshooting scenario '${title}: ${desc}', give ONE brief, clever hint (maximum 1 sentence) to guide the student towards finding the solution, without directly giving the exact answer away.`;
      for (const modelName of ['gemini-3.7-flash', 'gemini-3.5-flash-lite']) {
        try {
          const response = await ai.models.generateContent({ model: modelName, contents: prompt });
          if (response && response.text) {
            return res.status(200).json({ hint: response.text.trim(), status: 'success' });
          }
        } catch (e) {}
      }
      throw new Error('Unable to generate hint.');
    }

    // Default: generate scenario
    const domains = [
      "Storage & Volumes (PV, PVC, StorageClasses, access modes)",
      "Services & Networking (ClusterIP, NodePort, Ingress, NetworkPolicies, CoreDNS, CNI)",
      "Scheduling & Pod Placement (Taints, Tolerations, NodeAffinity, ResourceQuotas)",
      "Cluster Maintenance & Upgrades (ETCD backup/restore, kubeadm upgrade, kubelet certs)",
      "Application Lifecycle & Rollouts (Deployments, RollingUpdates, Rollbacks, InitContainers)",
      "Security & Cluster Access (RBAC Roles, RoleBindings, ClusterRoles, ServiceAccounts)",
      "Advanced Troubleshooting (CrashLoopBackOff, OOMKilled, Worker Node NotReady, crictl)"
    ];
    const selectedDomain = domains[Math.floor(Math.random() * domains.length)];

    const prompt = `Generate a unique, creative, realistic Kubernetes production outage or troubleshooting incident for a CKA exam challenge.
Focused Domain: ${selectedDomain}
Random Seed: ${Math.floor(Math.random() * 90000) + 10000}

Return ONLY a valid JSON object without markdown fences, with these exact keys:
{
  "title": "Incident Name",
  "domain": "${selectedDomain.split('(')[0].trim()}",
  "desc": "Detailed problem description with realistic error output / kubectl logs",
  "correct_answer": "The single correct kubectl command or YAML fix",
  "wrong_answers": ["Realistic distractor 1", "Realistic distractor 2", "Realistic distractor 3"],
  "explanation": "Clear explanation of why the correct fix works"
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

          const correctAns = data.correct_answer || (data.options && data.options[data.correct || 0]);
          const wrongAns = data.wrong_answers || (data.options ? data.options.filter((_, i) => i !== (data.correct || 0)) : []);
          const allOptions = [correctAns, ...wrongAns.slice(0, 3)].sort(() => Math.random() - 0.5);
          const correctIdx = allOptions.indexOf(correctAns);

          const scenarioObj = {
            title: data.title || "Kubernetes Outage Incident",
            domain: data.domain || selectedDomain.split('(')[0].trim(),
            desc: data.desc || "A cluster issue occurred requiring resolution.",
            options: allOptions,
            correct: correctIdx,
            explanation: data.explanation || "This resolves the failure by correctly configuring Kubernetes resources."
          };
          return res.status(200).json({ scenario: scenarioObj, status: 'success' });
        }
      } catch (e) {}
    }
    throw new Error('Failed to generate scenario.');
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
