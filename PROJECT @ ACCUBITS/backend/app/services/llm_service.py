from __future__ import annotations

import hashlib
from typing import Iterable

from openai import OpenAI

from app.core.config import settings


class LLMService:
    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    @property
    def mode(self) -> str:
        return "openai" if self.client else "demo"

    def embed_texts(self, texts: Iterable[str]) -> list[list[float]]:
        texts = list(texts)
        if not texts:
            return []

        if self.client:
            response = self.client.embeddings.create(
                model=settings.openai_embedding_model,
                input=texts,
            )
            return [item.embedding for item in response.data]

        return [self._fallback_embedding(text) for text in texts]

    def embed_text(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]

    def generate_answer(self, question: str, history: list[dict], context_chunks: list[dict]) -> str:
        if self.client:
            context_text = "\n\n".join(
                f"Source: {chunk['document']}\n{chunk['text']}" for chunk in context_chunks
            )
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are an agent-building assistant. Use the provided context when it is relevant. "
                        "If the answer is not in the context, say that clearly and still be helpful."
                    ),
                }
            ]
            messages.extend(history)
            messages.append(
                {
                    "role": "user",
                    "content": f"Context:\n{context_text}\n\nQuestion:\n{question}",
                }
            )
            response = self.client.chat.completions.create(
                model=settings.openai_chat_model,
                messages=messages,
            )
            return response.choices[0].message.content or ""

        if context_chunks:
            joined_sources = ", ".join(chunk["document"] for chunk in context_chunks[:2])
            snippet = context_chunks[0]["text"][:280]
            return (
                f"Demo mode answer: based on {joined_sources}, the most relevant context says: "
                f"{snippet} Answer your real use case by adding an OpenAI API key in backend/.env."
            )

        return (
            "Demo mode answer: I could not find relevant indexed context yet. Add documents to "
            "backend/data/documents and call the ingest endpoint, or configure OPENAI_API_KEY for full LLM responses."
        )

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
