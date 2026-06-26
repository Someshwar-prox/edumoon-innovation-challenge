import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("."))

from app.modules.readiness_report.service import ReadinessReportService, ReadinessContext
from app.core.config import settings

class DummyEmbedding:
    def embed_query(self, query): return [0.1] * 384
    def embed(self, texts): return [[0.1] * 384 for _ in texts]

class DummyQdrant:
    def search(self, **kwargs): return []
    def count(self, **kwargs): 
        class DummyCount:
            count = 0
        return DummyCount()
    def upsert(self, **kwargs): return None

class DummyGroq:
    def complete_json(self, system, user):
        return {
            "score": 0,
            "subscores": {"digital_presence": 0, "data_maturity": 0, "customer_support": 0, "automation": 0, "tooling": 0},
            "strengths": [],
            "weaknesses": ["No data"],
            "opportunities": [],
            "automation_suggestions": []
        }

async def main():
    print("Testing ReadinessReportService with 0 documents...")
    ctx = ReadinessContext(
        business_id="ca5b702e-a559-4a7f-b723-6f4a6ef3b7cf",
        focus_areas=None,
        include_documents=True,
        language="en",
        embedding_model=DummyEmbedding(),
        qdrant=DummyQdrant(),
        groq=DummyGroq()
    )
    svc = ReadinessReportService(ctx)
    report = svc.run()
    print("SUCCESS! Report score:", report.score)

if __name__ == "__main__":
    asyncio.run(main())
