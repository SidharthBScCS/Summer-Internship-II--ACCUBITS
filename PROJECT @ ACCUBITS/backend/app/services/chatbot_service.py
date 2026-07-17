from __future__ import annotations

from app.services.rag_service import RAGService


class ChatbotService:
    def __init__(self) -> None:
        self.rag = RAGService()

    def answer(self, message: str, history: list[dict]) -> dict:
        return self.rag.answer(question=message.strip(), history=history)

    def status(self) -> dict:
        return self.rag.status()

    def ingest(self) -> dict:
        return self.rag.ingest_documents()
