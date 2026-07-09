from functools import lru_cache

from fastapi import APIRouter

from app.models.schemas import AppStatus, ChatRequest, ChatResponse, IngestResponse
from app.services.rag_service import RAGService


router = APIRouter()


@lru_cache
def get_rag_service() -> RAGService:
    return RAGService()


@router.get("/status", response_model=AppStatus)
def get_status() -> AppStatus:
    return AppStatus(**get_rag_service().status())


@router.post("/ingest", response_model=IngestResponse)
def ingest_documents() -> IngestResponse:
    return IngestResponse(**get_rag_service().ingest_documents())


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    history = [message.model_dump() for message in payload.history]
    result = get_rag_service().answer(question=payload.message, history=history)
    return ChatResponse(**result)
