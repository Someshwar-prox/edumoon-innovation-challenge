import os
from qdrant_client import QdrantClient
from qdrant_client.http import models

client = QdrantClient(
    url="https://ec2934f6-f894-4d53-afdc-f781e7e5cd94.australia-southeast1-0.gcp.cloud.qdrant.io:6333",
    api_key=os.environ.get("QDRANT_API_KEY", "")
)

# Fetch all points to find anything with Bombay
try:
    client.delete(
        collection_name="kb_master",
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="business_id",
                        match=models.MatchValue(value="9cb42a50-9c0a-4719-8612-14d94e525cc8")
                    )
                ]
            )
        )
    )
    print("Deleted all points for business 9cb42a50...")
except Exception as e:
    print(e)
