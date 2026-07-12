import asyncio
import os
from app.core.database import AsyncSessionLocal
from app.models.models import Document
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Document).order_by(Document.uploaded_at.desc()).limit(1))
        doc = res.scalar_one_or_none()
        if doc:
            print("Status:", doc.status)
            print("Extracted:", doc.extracted_data)
            print("Anomalies:", doc.anomalies)
            print("File path:", doc.file_path)

if __name__ == "__main__":
    asyncio.run(main())
