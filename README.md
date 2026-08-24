# ☸️ Roundchat.in — Kubernetes & CKA Masterclass Hub with Gemini AI

An interactive, visual learning platform and exam study laboratory for **Kubernetes Administrators (CKA / CKAD / CKS)** and DevOps engineers.

---

## ✨ Key Features

1. **☸️ K8s AI Copilot & CKA Mentor (Powered by Google Gemini)**:
   - Floating AI assistant capable of generating production-ready YAML manifests, troubleshooting incident errors (*CrashLoopBackOff, OOMKilled, Node NotReady*), and explaining complex cluster mechanisms.
   - One-click **"✨ Ask AI Mentor"** button directly integrated into every syllabus topic modal.
   - **"🤖 AI Root-Cause Analysis"** integration inside the Chaos Rescue mini-game to explain failures in depth.
   - Dual-mode support: Seamless backend proxy (`/api/chat`) with client-side fallback option for static hosting (e.g. GitHub Pages).

2. **🔬 Interactive Cluster Architecture Flow Simulator**:
   - Visual control plane & worker node topology with real-time SVG connection lines.
   - Slow-motion packet tracing with labeled message pills across 5 core workflows:
     - 🚀 *1. Pod Creation (`kubectl run`)*
     - 🗑️ *2. Pod Deletion (`kubectl delete`)*
     - 🔄 *3. Self-Healing Crash (`ReplicaSet Loop`)*
     - 🚧 *4. Node Drain (`kubectl drain`)*
     - 🌐 *5. Service Routing (`ClusterIP / kube-proxy`)*
   - Dedicated **"■ Stop Simulation"** button and concurrency protection.

3. **📚 Exhaustive CKA Syllabus Masterclass**:
   - 25+ clickable subtopic chips covering all 5 CKA domains.
   - Deep-dive stacked modal views featuring **Core Overview**, **Underlying Logic**, **Exam Pro-Tips**, and **Production YAML & CLI Commands**.

4. **🎮 CKA Chaos Rescue: Quick-Fire Exam Challenge**:
   - Timed incident response game simulating real-world exam and production emergencies.
   - Live score tracking, streaks, instant explanations, and AI deep-dive analysis.

---

## 🚀 Quick Start Guide

### 1. Configure Your Gemini API Key
Get your free API key from [Google AI Studio](https://aistudio.google.com/).

Create or edit `.env`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=8000
HOST=0.0.0.0
```

### 2. Run the Backend Server (Python)
```bash
# Activate virtual environment
.\.venv\Scripts\activate

# Start the server
python server.py
```
Open **http://localhost:8000** in your browser.

---

### Alternative: Run with Node.js
```bash
npm install
npm start
```

---

## 🌐 Deploying to GitHub Pages or Static Hosting
If hosting statically on GitHub Pages:
1. Push `index.html` to your repository.
2. Visitors can click the **⚙️ Settings** icon inside the AI Copilot drawer to enter their own Google AI Studio key (stored privately in their browser's `localStorage`).