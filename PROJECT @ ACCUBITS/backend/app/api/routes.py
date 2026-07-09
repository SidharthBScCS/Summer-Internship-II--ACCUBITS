from functools import lru_cache

from fastapi import APIRouter

from app.models.schemas import AppStatus, ChatRequest, ChatResponse, IngestResponse
from app.services.chatbot_service import ChatbotService


router = APIRouter()


@lru_cache
def get_chatbot_service() -> ChatbotService:
    return ChatbotService()


@router.get("/status", response_model=AppStatus)
def get_status() -> AppStatus:
    return AppStatus(**get_chatbot_service().status())


@router.post("/ingest", response_model=IngestResponse)
def ingest_documents() -> IngestResponse:
    return IngestResponse(**get_chatbot_service().ingest())


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    history = [message.model_dump() for message in payload.history]
    result = get_chatbot_service().answer(message=payload.message, history=history)
    return ChatResponse(**result)
