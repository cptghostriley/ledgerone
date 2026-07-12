import asyncio
from app.core.database import AsyncSessionLocal
from app.models.models import SchemaDef
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(SchemaDef).limit(1))
        schema = res.scalar_one_or_none()
        if schema:
            print(schema.fields)
        else:
            print("No schemas found.")

if __name__ == "__main__":
    asyncio.run(main())
