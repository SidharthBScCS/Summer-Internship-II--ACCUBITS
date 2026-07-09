from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.services.llm_service import LLMService
from app.services.vector_store import JsonVectorStore


class RAGService:
    def __init__(self) -> None:
        self.llm = LLMService()
        self.store = JsonVectorStore(settings.vector_store_path)
        settings.documents_dir.mkdir(parents=True, exist_ok=True)

    def ingest_documents(self) -> dict:
        files = list(settings.documents_dir.glob("*.txt")) + list(settings.documents_dir.glob("*.md"))
        records: list[dict] = []

        for file in files:
            chunks = self._chunk_text(file.read_text(encoding="utf-8"), chunk_size=700, overlap=120)
            embeddings = self.llm.embed_texts(chunks)
            for chunk, embedding in zip(chunks, embeddings, strict=False):
                records.append(
                    {
                        "id": str(uuid4()),
                        "document": file.name,
                        "text": chunk,
                        "embedding": embedding,
                    }
                )

        self.store.upsert(records)
        return {
            "indexed_documents": len(files),
            "indexed_chunks": len(records),
            "mode": self.llm.mode,
        }

    def answer(self, question: str, history: list[dict]) -> dict:
        query_embedding = self.llm.embed_text(question)
        results = self.store.search(query_embedding, settings.top_k)
        answer = self.llm.generate_answer(question=question, history=history, context_chunks=results)
        return {
            "answer": answer,
            "sources": results,
            "mode": self.llm.mode,
        }

    def status(self) -> dict:
        records = self.store.load()
        documents = {record["document"] for record in records}
        return {
            "rag_ready": len(records) > 0,
            "llm_mode": self.llm.mode,
            "document_count": len(documents),
        }

    @staticmethod
    def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
        text = text.strip()
        if not text:
            return []

        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = min(len(text), start + chunk_size)
            chunks.append(text[start:end])
            if end == len(text):
                break
            start = max(end - overlap, start + 1)
        return chunks
