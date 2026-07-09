from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class SourceChunk(BaseModel):
    id: str
    text: str
    score: float
    document: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    mode: str


class IngestResponse(BaseModel):
    indexed_documents: int
    indexed_chunks: int
    mode: str


class AppStatus(BaseModel):
    rag_ready: bool
    llm_mode: str
    document_count: int
