import abc
import json
import logging
import asyncio
from typing import Any, Type, Dict, List
import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """You are a document intelligence engine for Indian CA firms.
Rules:
1. Extract ONLY what is explicitly present. Never infer or hallucinate.
2. Return null for any field not found in the document.
3. All monetary values: numbers only, no currency symbols (e.g. 150000 not ₹1,50,000).
4. All dates: ISO 8601 format YYYY-MM-DD.
5. All PAN: uppercase, no spaces.
6. All GSTIN: uppercase, 15 characters exactly.
7. Respond ONLY with valid JSON. No explanation, no markdown fences."""

def strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
    return text

class LLMService(abc.ABC):
    @abc.abstractmethod
    async def extract_from_text(self, text: str, user_prompt: str, schema_class: Type[BaseModel]) -> BaseModel:
        pass
        
    @abc.abstractmethod
    async def extract_from_image(self, base64_image: str, user_prompt: str, schema_class: Type[BaseModel]) -> BaseModel:
        pass

    @abc.abstractmethod
    async def extract_from_audio(self, base64_audio: str, user_prompt: str, schema_class: Type[BaseModel]) -> BaseModel:
        pass

    @abc.abstractmethod
    async def merge_results(self, extractions: list[Dict], schema_class: Type[BaseModel]) -> BaseModel:
        pass

    @abc.abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        pass

class Gemma4OllamaService(LLMService):
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.embed_model = settings.ollama_embedding_model
        
    async def _call_ollama_with_retry(self, payload: dict, schema_class: Type[BaseModel], is_qa=False) -> BaseModel:
        payload["model"] = self.model
        payload["stream"] = False
        payload["options"] = {
            "temperature": 0.3 if is_qa else 0.1,
            "num_ctx": 32768 if is_qa else 8192
        }

        # Setup exponential backoffs
        backoffs = [2, 4, 8]
        
        for attempt in range(settings.ollama_max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
                    response = await client.post(f"{self.base_url}/api/chat", json=payload)
                    response.raise_for_status()
                    
                    data = response.json()
                    content = data.get("message", {}).get("content", "")
                    
                    clean_json = strip_markdown_fences(content)
                    try:
                        parsed = json.loads(clean_json)
                        return schema_class.model_validate(parsed)
                    except json.JSONDecodeError:
                        if attempt < settings.ollama_max_retries:
                            # Issue a strict JSON correction step
                            payload["messages"].append({"role": "assistant", "content": content})
                            payload["messages"].append({"role": "user", "content": "You returned invalid JSON. Please return strictly valid JSON."})
                            raise Exception("Invalid JSON formatting")
                        else:
                            raise
            except Exception as e:
                if attempt < settings.ollama_max_retries:
                    await asyncio.sleep(backoffs[attempt])
                else:
                    logger.error(f"Gemma4 invocation failed: {e}")
                    raise

    async def extract_from_text(self, text: str, user_prompt: str, schema_class: Type[BaseModel]) -> BaseModel:
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"{user_prompt}\n\nDocument Text:\n{text}"}
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class)

    async def extract_from_image(self, base64_image: str, user_prompt: str, schema_class: Type[BaseModel]) -> BaseModel:
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt, "images": [base64_image]}
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class)

    async def extract_from_audio(self, base64_audio: str, user_prompt: str, schema_class: Type[BaseModel]) -> BaseModel:
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt, "audio": base64_audio}  # specific API extension required for this
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class)

    async def merge_results(self, extractions: list[Dict], schema_class: Type[BaseModel]) -> BaseModel:
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"Merge the following document extractions into a single complete JSON object according to your instructions.\n\nExtractions: {json.dumps(extractions)}"}
            ]
        }
        # Mark as somewhat QA to expand context
        return await self._call_ollama_with_retry(payload, schema_class, is_qa=True)

    async def embed_text(self, text: str) -> List[float]:
        payload = {
            "model": self.embed_model,
            "prompt": text
        }
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(f"{self.base_url}/api/embeddings", json=payload)
            response.raise_for_status()
            return response.json().get("embedding", [])
