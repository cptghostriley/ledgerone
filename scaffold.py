import os

folders = [
    "app/api/v1",
    "app/core",
    "app/models",
    "app/schemas",
    "app/services",
    "app/workers",
    "alembic/versions",
    "config",
    "tests",
    "docker",
]

for folder in folders:
    os.makedirs(folder, exist_ok=True)

with open("app/__init__.py", "w") as f: f.write("")
with open("app/api/__init__.py", "w") as f: f.write("")
with open("app/api/v1/__init__.py", "w") as f: f.write("")
with open("app/core/__init__.py", "w") as f: f.write("")
with open("app/models/__init__.py", "w") as f: f.write("")
with open("app/schemas/__init__.py", "w") as f: f.write("")
with open("app/services/__init__.py", "w") as f: f.write("")
with open("app/workers/__init__.py", "w") as f: f.write("")

print("Project scaffolded successfully.")
