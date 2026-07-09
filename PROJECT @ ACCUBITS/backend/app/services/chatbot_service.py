from __future__ import annotations

import re

from openai import OpenAI

from app.core.config import settings


class ChatbotService:
    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def answer(self, message: str, history: list[dict]) -> dict:
        reply = self._generate_reply(message.strip(), history)
        return {
            "answer": reply,
            "sources": [],
            "mode": self.mode,
        }

    def status(self) -> dict:
        return {
            "rag_ready": False,
            "llm_mode": self.mode,
            "document_count": 0,
        }

    def ingest(self) -> dict:
        return {
            "indexed_documents": 0,
            "indexed_chunks": 0,
            "mode": self.mode,
        }

    @property
    def mode(self) -> str:
        return "openai-chat" if self.client else "simple-chatbot"

    def _generate_reply(self, message: str, history: list[dict]) -> str:
        if self.client:
            try:
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful, conversational AI assistant similar to ChatGPT. "
                            "Answer naturally, clearly, and directly. Use the conversation history "
                            "to stay context-aware. Be concise by default, but explain more when useful."
                        ),
                    }
                ]
                messages.extend(history)
                messages.append({"role": "user", "content": message})

                response = self.client.chat.completions.create(
                    model=settings.openai_chat_model,
                    messages=messages,
                )
                return response.choices[0].message.content or "I could not generate a response just now."
            except Exception:
                # Fall back gracefully so the app remains usable during key, quota, or network issues.
                pass

        lowered = message.lower()
        if self._matches(lowered, ["hi", "hello", "hey", "good morning", "good evening"]):
            return "Hello! I am your chatbot. Ask me anything, and I will do my best to help."

        if "how are you" in lowered:
            return "I am doing well and ready to chat. What would you like help with?"

        if self._matches(lowered, ["your name", "who are you", "what are you"]):
            return "I am your chatbot running in the FastAPI backend. When available, I use an OpenAI chat model."

        if self._matches(lowered, ["help", "what can you do", "what can u do"]):
            return (
                "I can chat with you, answer questions, explain ideas, and continue a conversation using your current chat history."
            )

        if "thank" in lowered:
            return "You are welcome. If you want, we can keep chatting."

        if self._matches(lowered, ["bye", "goodbye", "see you"]):
            return "Goodbye! Come back anytime."

        if "project" in lowered:
            return (
                "This project sends your message from the frontend to the FastAPI backend and returns a chatbot response to the UI."
            )

        if "frontend" in lowered and "backend" in lowered:
            return (
                "The frontend handles the chat interface and history, while the backend handles the chat response logic."
            )

        if "history" in lowered:
            return f"You currently have {len(history)} earlier message(s) in this chat before your latest prompt."

        question_word = self._extract_question_word(lowered)
        if question_word:
            return (
                f"You asked a {question_word} question: \"{message}\". "
                "I can help continue the conversation, explain ideas, or answer in a more detailed way if you want."
            )

        templates = [
            "You said: \"{message}\". Tell me more and I will keep the conversation going.",
            "I received your message: \"{message}\". What would you like to explore next?",
            "That sounds interesting: \"{message}\". Want to continue this topic?",
        ]
        index = (len(history) + len(message)) % len(templates)
        return templates[index].format(message=message)

    @staticmethod
    def _matches(lowered: str, phrases: list[str]) -> bool:
        return any(phrase in lowered for phrase in phrases)

    @staticmethod
    def _extract_question_word(lowered: str) -> str:
        match = re.match(r"^(what|why|how|when|where|who)\b", lowered)
        return match.group(1) if match else ""
