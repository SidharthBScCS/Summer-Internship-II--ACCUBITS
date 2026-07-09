import json
import math
from pathlib import Path


class JsonVectorStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> list[dict]:
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text(encoding="utf-8"))

    def save(self, records: list[dict]) -> None:
        self.path.write_text(json.dumps(records, indent=2), encoding="utf-8")

    def upsert(self, records: list[dict]) -> None:
        self.save(records)

    def search(self, query_embedding: list[float], top_k: int) -> list[dict]:
        records = self.load()
        scored = []
        for record in records:
            score = self._cosine_similarity(query_embedding, record["embedding"])
            scored.append({**record, "score": score})

        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:top_k]

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        numerator = sum(x * y for x, y in zip(a, b, strict=False))
        a_norm = math.sqrt(sum(x * x for x in a))
        b_norm = math.sqrt(sum(y * y for y in b))
        if a_norm == 0 or b_norm == 0:
            return 0.0
        return numerator / (a_norm * b_norm)
