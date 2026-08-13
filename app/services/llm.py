import abc
import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Type

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
7. Respond ONLY with valid JSON matching the requested schema. No explanation, no markdown fences."""


def strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
        # Handle cases like ```json at start without closing fence on dedicated line
        if lines[0].startswith("```"):
            return "\n".join(lines[1:]).strip().rstrip("```").strip()
    return text


def clean_base64(b64_string: str) -> str:
    """Removes data URI prefix if present (e.g., data:image/png;base64,...)."""
    if "," in b64_string and b64_string.startswith("data:"):
        return b64_string.split(",", 1)[1]
    return b64_string


class LLMService(abc.ABC):
    @abc.abstractmethod
    async def extract_from_text(
        self, text: str, user_prompt: str, schema_class: Type[BaseModel]
    ) -> BaseModel:
        pass

    @abc.abstractmethod
    async def extract_from_image(
        self, base64_image: str, user_prompt: str, schema_class: Type[BaseModel]
    ) -> BaseModel:
        pass

    @abc.abstractmethod
    async def extract_from_audio(
        self, base64_audio: str, user_prompt: str, schema_class: Type[BaseModel]
    ) -> BaseModel:
        pass

    @abc.abstractmethod
    async def merge_results(
        self, extractions: List[Dict], schema_class: Type[BaseModel]
    ) -> BaseModel:
        pass

    @abc.abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        pass


class Gemma4OllamaService(LLMService):
    def __init__(self, model_name: Optional[str] = None):
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = model_name or settings.ollama_model
        self.embed_model = settings.ollama_embedding_model

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.3,
        num_ctx: int = 32768,
        model: Optional[str] = None,
    ) -> str:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx,
            },
        }
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")

    async def chat_json(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.0,
        num_ctx: int = 8192,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx,
            },
        }
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
            content = data.get("message", {}).get("content", "{}")
            parsed = json.loads(strip_markdown_fences(content))
            if not isinstance(parsed, dict):
                raise ValueError("Expected JSON object from chat_json")
            return parsed

    async def _call_ollama_with_retry(
        self, payload: Dict[str, Any], schema_class: Type[BaseModel], is_qa: bool = False
    ) -> BaseModel:
        payload["model"] = payload.get("model", self.model)
        payload["stream"] = False
        payload["format"] = "json"
        payload["options"] = {
            "temperature": 0.3 if is_qa else 0.1,
            "num_ctx": 32768 if is_qa else 8192,
        }

        backoffs = [2, 4, 8]
        max_retries = getattr(settings, "ollama_max_retries", 3)

        for attempt in range(max_retries + 1):
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
                    except (json.JSONDecodeError, Exception) as parse_err:
                        if attempt < max_retries:
                            logger.warning(
                                f"JSON validation failed on attempt {attempt + 1}: {parse_err}. Retrying..."
                            )
                            payload["messages"].append({"role": "assistant", "content": content})
                            payload["messages"].append(
                                {
                                    "role": "user",
                                    "content": f"Your response failed validation: {parse_err}. Please output strictly valid JSON conforming to the schema.",
                                }
                            )
                        else:
                            raise parse_err
            except Exception as e:
                if attempt < max_retries:
                    await asyncio.sleep(backoffs[min(attempt, len(backoffs) - 1)])
                else:
                    logger.error(f"Ollama invocation failed after {max_retries} attempts: {e}")
                    raise

    async def extract_from_text(
        self, text: str, user_prompt: str, schema_class: Type[BaseModel]
    ) -> BaseModel:
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"{user_prompt}\n\nDocument Text:\n{text}"},
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class)

    async def extract_from_image(
        self, base64_image: str, user_prompt: str, schema_class: Type[BaseModel]
    ) -> BaseModel:
        clean_img = clean_base64(base64_image)
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt, "images": [clean_img]},
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class)

    async def extract_from_audio(
        self, base64_audio: str, user_prompt: str, schema_class: Type[BaseModel]
    ) -> BaseModel:
        clean_aud = clean_base64(base64_audio)
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt, "audio": clean_aud},
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class)

    async def merge_results(
        self, extractions: List[Dict], schema_class: Type[BaseModel]
    ) -> BaseModel:
        payload = {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Merge the following document extractions into a single complete JSON object according to your instructions.\n\nExtractions: {json.dumps(extractions)}",
                },
            ]
        }
        return await self._call_ollama_with_retry(payload, schema_class, is_qa=True)

    async def embed_text(self, text: str) -> List[float]:
        payload = {"model": self.embed_model, "input": text}
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(f"{self.base_url}/api/embed", json=payload)
            response.raise_for_status()
            data = response.json()
            embeddings = data.get("embeddings", [])
            return embeddings[0] if embeddings else []


# Alias for backward compatibility if imported elsewhere
QwenOllamaService = Gemma4OllamaService