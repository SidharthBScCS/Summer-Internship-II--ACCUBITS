from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Iterable
from urllib import error, parse, request

from app.core.config import settings


class LLMService:
    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key.strip()

    @property
    def mode(self) -> str:
        return "gemini" if self.api_key else "missing-gemini-key"

    def embed_texts(self, texts: Iterable[str]) -> list[list[float]]:
        texts = list(texts)
        if not texts:
            return []

        if self.api_key:
            return [self._embed_with_gemini(text) for text in texts]

        return [self._fallback_embedding(text) for text in texts]

    def embed_text(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]

    def generate_answer(self, question: str, history: list[dict], context_chunks: list[dict]) -> str:
        if not self.api_key:
            return (
                "Gemini is not connected yet. Add your `GEMINI_API_KEY` in `backend/.env`, "
                "restart the backend, and then I can answer like an AI assistant."
            )

        contents = self._build_contents(question, history, context_chunks)
        payload = self._build_rich_payload(question, contents)

        data = self._post_to_gemini(
            model=settings.gemini_model,
            action="generateContent",
            payload=payload,
        )
        text = self._extract_text(data)
        if text:
            return text

        error_message = self._extract_error(data)
        if error_message:
            return f"Gemini error: {error_message}"

        fallback_data = self._post_to_gemini(
            model=settings.gemini_model,
            action="generateContent",
            payload=self._build_basic_payload(question, history),
        )
        fallback_text = self._extract_text(fallback_data)
        if fallback_text:
            return fallback_text

        fallback_error = self._extract_error(fallback_data)
        if fallback_error:
            return f"Gemini error: {fallback_error}"

        return "Gemini did not return a response. Check your API key, billing, model access, and internet access on the backend machine."

    def _build_rich_payload(self, question: str, contents: list[dict]) -> dict:
        payload = {
            "system_instruction": {
                "parts": [
                    {
                        "text": self._system_prompt(),
                    }
                ]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.9,
                "maxOutputTokens": 2048,
            },
        }

        if self._should_use_search(question):
            payload["tools"] = [{"google_search": {}}]

        return payload

    def _build_basic_payload(self, question: str, history: list[dict]) -> dict:
        basic_contents: list[dict] = []

        trimmed_history = (
            history[:-1]
            if history and history[-1].get("role") == "user" and history[-1].get("content", "").strip() == question.strip()
            else history
        )

        for message in trimmed_history[-6:]:
            role = "model" if message.get("role") == "assistant" else "user"
            text = message.get("content", "").strip()
            if text:
                basic_contents.append({"role": role, "parts": [{"text": text}]})

        basic_contents.append({"role": "user", "parts": [{"text": question}]})

        return {
            "contents": basic_contents,
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.9,
                "maxOutputTokens": 2048,
            },
        }

    def _system_prompt(self) -> str:
        today = datetime.now().strftime("%A, %B %d, %Y")
        return (
            "You are a real AI assistant in a web chat app. "
            "Answer naturally, clearly, and directly like Gemini. "
            "Use conversation history when relevant. "
            "For current-date, current-leader, current-events, or other latest-information questions, "
            "use grounded web search when needed. "
            f"The server's current local date is {today}. "
            "If indexed project context is provided, use it when helpful, but do not limit yourself to only that context."
        )

    def _build_contents(self, question: str, history: list[dict], context_chunks: list[dict]) -> list[dict]:
        contents: list[dict] = []

        trimmed_history = history[:-1] if history and history[-1].get("role") == "user" and history[-1].get("content", "").strip() == question.strip() else history

        for message in trimmed_history[-10:]:
            role = "model" if message.get("role") == "assistant" else "user"
            text = message.get("content", "").strip()
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})

        if context_chunks:
            context_text = "\n\n".join(
                f"Source: {chunk['document']}\n{chunk['text']}" for chunk in context_chunks
            )
            contents.append(
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                "Use this project context if it helps answer the next question.\n\n"
                                f"{context_text}"
                            )
                        }
                    ],
                }
            )

        contents.append({"role": "user", "parts": [{"text": question}]})
        return contents

    @staticmethod
    def _should_use_search(question: str) -> bool:
        lowered = question.lower()
        search_markers = [
            "today",
            "latest",
            "current",
            "now",
            "who is the pm",
            "prime minister",
            "president",
            "date",
            "time",
            "news",
        ]
        return any(marker in lowered for marker in search_markers)

    def _embed_with_gemini(self, text: str) -> list[float]:
        payload = {
            "model": f"models/{settings.gemini_embedding_model}",
            "taskType": "RETRIEVAL_DOCUMENT",
            "content": {"parts": [{"text": text}]},
        }
        data = self._post_to_gemini(
            model=settings.gemini_embedding_model,
            action="embedContent",
            payload=payload,
        )
        embedding = data.get("embedding", {})
        values = embedding.get("values", [])
        return values if values else self._fallback_embedding(text)

    def _post_to_gemini(self, model: str, action: str, payload: dict) -> dict:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:{action}"
            f"?key={parse.quote(self.api_key)}"
        )
        gemini_request = request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )

        try:
            with request.urlopen(gemini_request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            try:
                body = exc.read().decode("utf-8")
                return json.loads(body)
            except (OSError, json.JSONDecodeError):
                return {"error": {"message": f"HTTP {exc.code}: {exc.reason}"}}
        except error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            return {"error": {"message": f"Network error: {reason}"}}
        except TimeoutError:
            return {"error": {"message": "Request to Gemini timed out"}}
        except json.JSONDecodeError:
            return {"error": {"message": "Could not decode Gemini response"}}

    @staticmethod
    def _extract_text(data: dict) -> str:
        candidates = data.get("candidates", [])
        for candidate in candidates:
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            fragments = [part.get("text", "") for part in parts if part.get("text")]
            if fragments:
                return "\n".join(fragments).strip()
        return ""

    @staticmethod
    def _extract_error(data: dict) -> str:
        error_block = data.get("error", {})
        if isinstance(error_block, dict):
            message = error_block.get("message", "").strip()
            if message:
                return message
        return ""

    @staticmethod
    def _fallback_embedding(text: str, size: int = 64) -> list[float]:
        values = [0.0] * size
        tokens = text.lower().split()
        if not tokens:
            return values

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = digest[0] % size
            values[index] += 1.0

        norm = sum(values) or 1.0
        return [value / norm for value in values]
