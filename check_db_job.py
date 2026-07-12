import asyncio
from app.core.database import AsyncSessionLocal
from app.models.models import Job
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Job).order_by(Job.created_at.desc()).limit(1))
        job = res.scalar_one_or_none()
        if job:
            print('Job Status:', job.status)
            print('Error:', job.error)

if __name__ == "__main__":
    asyncio.run(main())
