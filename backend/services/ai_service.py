import openai
import json
import os
import requests
from dotenv import load_dotenv
from services.logger import logger

backend_dir = os.path.join(os.path.dirname(__file__), '..')
dotenv_path = os.path.join(backend_dir, '.env')
example_dotenv_path = os.path.join(backend_dir, '.env.example')
load_dotenv(dotenv_path)

if not os.getenv('GROQ_API_KEY') and os.path.exists(example_dotenv_path):
    load_dotenv(example_dotenv_path)

def analyze_log_with_ai(log_content: str):
    prompt = f"""
    Analyze the following infrastructure log and return a JSON response with:
    summary, root_cause, severity, fix (list of strings).
    Log: {log_content}
    """

    api_key = os.getenv("GROQ_API_KEY")
    if api_key and len(api_key) > 10:
        try:
            client = openai.OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
                timeout=10.0,
                max_retries=0
            )
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.warning(f"Groq failed: {e}. Falling back to Ollama.")

    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            import ollama
            response = ollama.chat(
                model='llama3',
                messages=[{'role': 'user', 'content': prompt}],
                format='json'
            )
            return json.loads(response['message']['content'])
    except Exception as e:
        logger.warning(f"Ollama check failed: {e}.")

    return {
        "summary": "AI Analysis Unavailable",
        "root_cause": "Both Groq and Ollama failed",
        "severity": "critical",
        "fix": ["Check GROQ_API_KEY in backend/.env", "Ensure Ollama is running locally on port 11434"]
    }
