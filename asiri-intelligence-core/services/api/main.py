from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(
    title="Asiri Intelligence Core API",
    version="0.1.0",
    description="Core API for projects, tasks, decisions, memories, and unified search.",
)


class Project(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    slug: str
    description: str | None = None
    status: Literal["planned", "active", "paused", "completed", "archived"] = "planned"
    current_phase: str | None = None
    progress: int = Field(default=0, ge=0, le=100)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Decision(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    title: str
    decision: str
    rationale: str
    status: Literal["proposed", "approved", "superseded", "rejected"] = "approved"
    decided_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Memory(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    project_id: UUID | None = None
    kind: Literal["fact", "preference", "problem", "solution", "note", "source"]
    title: str | None = None
    content: str
    importance: int = Field(default=3, ge=1, le=5)
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


PROJECTS: dict[UUID, Project] = {}
DECISIONS: dict[UUID, Decision] = {}
MEMORIES: dict[UUID, Memory] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "asiri-intelligence-core", "version": app.version}


@app.get("/v1/projects", response_model=list[Project])
def list_projects() -> list[Project]:
    return list(PROJECTS.values())


@app.post("/v1/projects", response_model=Project, status_code=201)
def create_project(project: Project) -> Project:
    if any(item.slug == project.slug for item in PROJECTS.values()):
        raise HTTPException(status_code=409, detail="Project slug already exists")
    PROJECTS[project.id] = project
    return project


@app.post("/v1/decisions", response_model=Decision, status_code=201)
def create_decision(decision: Decision) -> Decision:
    if decision.project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail="Project not found")
    DECISIONS[decision.id] = decision
    return decision


@app.post("/v1/memories", response_model=Memory, status_code=201)
def create_memory(memory: Memory) -> Memory:
    if memory.project_id and memory.project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail="Project not found")
    MEMORIES[memory.id] = memory
    return memory


@app.get("/v1/search")
def universal_search(q: str = Query(min_length=2, max_length=200)) -> dict[str, object]:
    needle = q.casefold()
    projects = [p for p in PROJECTS.values() if needle in f"{p.name} {p.description or ''}".casefold()]
    decisions = [d for d in DECISIONS.values() if needle in f"{d.title} {d.decision} {d.rationale}".casefold()]
    memories = [m for m in MEMORIES.values() if needle in f"{m.title or ''} {m.content} {' '.join(m.tags)}".casefold()]
    return {
        "query": q,
        "total": len(projects) + len(decisions) + len(memories),
        "projects": projects,
        "decisions": decisions,
        "memories": memories,
    }
