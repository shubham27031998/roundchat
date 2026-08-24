import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict

# Load environment variables
load_dotenv()

app = FastAPI(title="sahaAI - Kubernetes Architect API")

# Enable CORS for local development and remote origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    topic: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None

SYSTEM_INSTRUCTION = """
You are sahaAI — an elite Kubernetes Architect, Certified Kubernetes Administrator (CKA/CKAD/CKS) mentor, and DevOps engineering tutor.

Your purpose is to provide clear, accurate, high-utility, and actionable Kubernetes assistance:
1. When asked for YAML, provide clean, production-ready manifests with syntax explanations and best practices (labels, resource limits, readiness/liveness probes, security contexts).
2. When asked for CLI commands, provide imperative `kubectl` commands along with dry-run shortcuts (e.g. `--dry-run=client -o yaml`).
3. When debugging incidents (CrashLoopBackOff, OOMKilled, Node NotReady, NetworkPolicy issues, ETCD failovers), provide structured root-cause analysis with step-by-step resolution commands.
4. Keep explanations concise, crystal clear, developer-friendly, and formatted nicely in GitHub-flavored Markdown.
5. Emphasize tips, gotchas, and speed tricks useful for the official CKA exam.
"""

def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing GenAI client: {e}", file=sys.stderr)
        return None

@app.get("/api/health")
async def health():
    api_key = os.getenv("GEMINI_API_KEY")
    has_key = bool(api_key and len(api_key.strip()) > 5)
    return {
        "status": "healthy",
        "has_api_key": has_key,
        "model": "gemini-2.5-flash",
        "service": "sahaAI"
    }

@app.post("/api/chat")
async def chat(request: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or len(api_key.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is not configured on the server. Please add your GEMINI_API_KEY in the .env file."
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        prompt_parts = []
        if request.topic:
            prompt_parts.append(f"[Topic Context: {request.topic}]")
        if request.context:
            prompt_parts.append(f"[Context / Reference Data:\n{request.context}\n]")
        
        prompt_parts.append(request.message)
        user_prompt = "\n\n".join(prompt_parts)

        # Call Gemini model with automatic fallback
        candidate_models = ["gemini-3.7-flash", "gemini-3.5-flash-lite"]
        response = None
        last_err = None

        for model_name in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.3,
                    )
                )
                if response and response.text:
                    break
            except Exception as model_err:
                last_err = model_err
                print(f"Model {model_name} error: {model_err}, trying fallback...", file=sys.stderr)

        if not response or not response.text:
            raise last_err or Exception("Failed to generate response from Gemini API.")

        return {
            "reply": response.text,
            "status": "success"
        }
    except Exception as e:
        print(f"Error in Gemini chat: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")

class HintRequest(BaseModel):
    title: str
    desc: str
    options: List[str]

@app.post("/api/game/hint")
async def game_hint(request: HintRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or len(api_key.strip()) < 5:
        raise HTTPException(status_code=400, detail="Gemini API Key missing.")

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        prompt = f"For the Kubernetes troubleshooting scenario '{request.title}: {request.desc}', give ONE brief, clever hint (maximum 1 sentence) to guide the student towards finding the solution, without directly giving the exact answer away."
        
        for model_name in ["gemini-3.7-flash", "gemini-3.5-flash-lite"]:
            try:
                res = client.models.generate_content(model=model_name, contents=prompt)
                if res and res.text:
                    return {"hint": res.text.strip(), "status": "success"}
            except Exception:
                continue
        raise Exception("Unable to generate hint.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/game/scenario")
async def game_scenario():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or len(api_key.strip()) < 5:
        raise HTTPException(status_code=400, detail="Gemini API Key missing.")

    try:
        from google import genai
        import json
        import random

        client = genai.Client(api_key=api_key)

        domains = [
            "Storage & Volumes (PV, PVC, StorageClasses, access modes, volumeMounts)",
            "Services & Networking (ClusterIP, NodePort, Ingress, NetworkPolicies, CoreDNS, CNI)",
            "Scheduling & Pod Placement (Taints, Tolerations, NodeAffinity, ResourceQuotas, Limits)",
            "Cluster Maintenance & Upgrades (ETCD backup/restore, kubeadm upgrade, kubelet certificates)",
            "Application Lifecycle & Rollouts (Deployments, RollingUpdates, Rollbacks, InitContainers)",
            "Security & Cluster Access (RBAC Roles, RoleBindings, ClusterRoles, ServiceAccounts)",
            "Advanced Troubleshooting (CrashLoopBackOff, OOMKilled, Worker Node NotReady, crictl)"
        ]
        selected_domain = random.choice(domains)

        prompt = f"""Generate a unique, creative, realistic Kubernetes production outage or troubleshooting incident for a CKA exam challenge.
Focused Domain: {selected_domain}
Random Seed: {random.randint(10000, 99999)}

Return ONLY a valid JSON object without markdown fences, with these exact keys:
{{
  "title": "Incident Name",
  "domain": "{selected_domain.split('(')[0].strip()}",
  "desc": "Detailed problem description with realistic error output / kubectl logs",
  "correct_answer": "The single correct kubectl command or YAML fix",
  "wrong_answers": ["Realistic distractor 1", "Realistic distractor 2", "Realistic distractor 3"],
  "explanation": "Clear explanation of why the correct fix works and how the underlying K8s subsystem behaves"
}}"""

        for model_name in ["gemini-3.7-flash", "gemini-3.5-flash-lite"]:
            try:
                res = client.models.generate_content(model=model_name, contents=prompt)
                if res and res.text:
                    clean_text = res.text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.startswith("```"):
                        clean_text = clean_text[3:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    data = json.loads(clean_text.strip())

                    # Shuffle options randomly
                    correct_ans = data.get("correct_answer") or data.get("options", [""])[data.get("correct", 0)]
                    wrong_ans = data.get("wrong_answers") or [opt for i, opt in enumerate(data.get("options", [])) if i != data.get("correct", 0)]
                    
                    all_options = [correct_ans] + wrong_ans[:3]
                    random.shuffle(all_options)
                    correct_idx = all_options.index(correct_ans)

                    scenario_obj = {
                        "title": data.get("title", "Kubernetes Outage Incident"),
                        "domain": data.get("domain", selected_domain.split('(')[0].strip()),
                        "desc": data.get("desc", "A cluster issue occurred requiring resolution."),
                        "options": all_options,
                        "correct": correct_idx,
                        "explanation": data.get("explanation", "This resolves the failure by correctly configuring Kubernetes resources.")
                    }
                    return {"scenario": scenario_obj, "status": "success"}
            except Exception as e:
                print(f"Scenario generation attempt with {model_name} failed: {e}", file=sys.stderr)
                continue
        raise Exception("Failed to generate valid randomized scenario.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve frontend static files
WORKSPACE_DIR = Path(__file__).parent.resolve()

@app.get("/")
async def serve_index():
    index_file = WORKSPACE_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "index.html not found"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"🚀 Starting Roundchat K8s AI Server on http://localhost:{port}")
    uvicorn.run("server.py:app", host=host, port=port, reload=True)
