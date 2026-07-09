# Agent Builder Knowledge Base

This starter project combines a React frontend with a FastAPI backend in a single repository.

The frontend offers:

- a new chat action
- a sidebar with chat history
- a clean interface for asking questions
- quick visibility into retrieved sources

The backend offers:

- a status endpoint
- a document ingestion endpoint
- a RAG-based chat endpoint
- a simple pluggable LLM service

Recommended production upgrades:

- move chat history to a database
- replace the JSON vector store with a real vector database
- stream model responses to the client
- add auth, rate limits, and document upload support
