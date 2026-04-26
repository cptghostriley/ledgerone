.PHONY: dev test lint migrate worker

dev:
	uvicorn app.main:app --reload

test:
	pytest -v

lint:
	ruff check .

migrate:
	alembic upgrade head

worker:
	celery -A app.workers.celery_app worker -l info -c 1
