"""
DevPrep API — production-ready version.

- JWT auth (POST /auth/signup, POST /auth/login)
- All /questions, /analytics, /topics routes require a valid bearer token
- Questions scoped per user_id
- Standardized response envelope: {success, data, message}
- Consistent error handling: 400 / 401 / 404 via HTTPException
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import load_data, save_data
from models import LoginRequest, QuestionCreate, QuestionUpdate, SignupRequest

app = FastAPI(title="DevPrep API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Response envelope helpers ───────────────────────────────────────────────
def ok(data: Any = None, message: str = "") -> dict:
    return {"success": True, "data": data, "message": message}


def fail(message: str, data: Any = None) -> dict:
    return {"success": False, "data": data, "message": message}


# ── Global error handlers: wrap errors in the same envelope ─────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=fail(exc.detail if isinstance(exc.detail, str) else "Request failed."),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(x) for x in first.get("loc", []) if x != "body")
    msg = first.get("msg", "Invalid request.")
    message = f"{loc}: {msg}" if loc else msg
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=fail(message),
    )


# ── Public ──────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return ok(
        data={"name": "DevPrep API", "version": "2.0.0"},
        message="DevPrep API is running 🚀",
    )


# ── Auth routes ─────────────────────────────────────────────────────────────
@app.post("/auth/signup")
def signup(payload: SignupRequest):
    data = load_data()
    email = payload.email.lower().strip()

    if any(u["email"] == email for u in data["users"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = {
        "id": str(uuid.uuid4())[:12],
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "created_at": datetime.utcnow().isoformat(),
    }
    data["users"].append(user)
    save_data(data)

    token = create_access_token(user_id=user["id"], email=user["email"])
    return ok(
        data={
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
        },
        message="Account created.",
    )


@app.post("/auth/login")
def login(payload: LoginRequest):
    data = load_data()
    email = payload.email.lower().strip()
    user = next((u for u in data["users"] if u["email"] == email), None)

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user_id=user["id"], email=user["email"])
    return ok(
        data={
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
        },
        message="Logged in.",
    )


@app.get("/auth/me")
def me(current=Depends(get_current_user)):
    data = load_data()
    user = next((u for u in data["users"] if u["id"] == current["user_id"]), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return ok(data={"id": user["id"], "name": user["name"], "email": user["email"]})


# ── Questions (protected) ───────────────────────────────────────────────────
def _user_questions(data: dict, user_id: str) -> list:
    return [q for q in data["questions"] if q.get("user_id") == user_id]


@app.get("/questions")
def list_questions(
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    status_filter: Optional[str] = None,
    current=Depends(get_current_user),
):
    data = load_data()
    qs = _user_questions(data, current["user_id"])
    if topic:
        qs = [q for q in qs if q["topic"].lower() == topic.lower()]
    if difficulty:
        qs = [q for q in qs if q["difficulty"].lower() == difficulty.lower()]
    if status_filter:
        qs = [q for q in qs if q["status"].lower() == status_filter.lower()]
    # newest first
    qs = sorted(qs, key=lambda q: q.get("created_at", ""), reverse=True)
    return ok(data={"questions": qs, "total": len(qs)})


@app.post("/questions")
def add_question(payload: QuestionCreate, current=Depends(get_current_user)):
    data = load_data()
    now = datetime.utcnow().isoformat()
    q = payload.model_dump()
    q["id"] = str(uuid.uuid4())[:8]
    q["user_id"] = current["user_id"]
    q["created_at"] = now
    q["solved_at"] = now if q["status"] == "solved" else None
    q["attempts"] = 0
    data["questions"].append(q)
    save_data(data)
    return ok(data=q, message="Question added.")


@app.put("/questions/{question_id}")
def update_question(
    question_id: str,
    update: QuestionUpdate,
    current=Depends(get_current_user),
):
    data = load_data()
    for i, q in enumerate(data["questions"]):
        if q["id"] == question_id and q.get("user_id") == current["user_id"]:
            patch = {k: v for k, v in update.model_dump().items() if v is not None}
            # solved_at bookkeeping
            new_status = patch.get("status", q["status"])
            if new_status == "solved" and q["status"] != "solved":
                patch["solved_at"] = datetime.utcnow().isoformat()
            elif new_status != "solved":
                patch["solved_at"] = None
            data["questions"][i].update(patch)
            save_data(data)
            return ok(data=data["questions"][i], message="Question updated.")
    raise HTTPException(status_code=404, detail="Question not found.")


@app.delete("/questions/{question_id}")
def delete_question(question_id: str, current=Depends(get_current_user)):
    data = load_data()
    before = len(data["questions"])
    data["questions"] = [
        q for q in data["questions"]
        if not (q["id"] == question_id and q.get("user_id") == current["user_id"])
    ]
    if len(data["questions"]) == before:
        raise HTTPException(status_code=404, detail="Question not found.")
    save_data(data)
    return ok(message="Question deleted.")


# ── Analytics (protected) ───────────────────────────────────────────────────
def _compute_streak(questions: list) -> int:
    """Count consecutive days (ending today or yesterday) with at least one solve."""
    from datetime import date, timedelta
    solved_days = {
        q["solved_at"][:10] for q in questions if q.get("solved_at")
    }
    if not solved_days:
        return 0
    streak = 0
    today = date.today()
    for i in range(365):
        day = (today - timedelta(days=i)).isoformat()
        if day in solved_days:
            streak += 1
        else:
            if i == 0:
                continue  # today may not have a solve yet
            break
    return streak


@app.get("/analytics")
def analytics(current=Depends(get_current_user)):
    data = load_data()
    questions = _user_questions(data, current["user_id"])

    topics: dict = {}
    for q in questions:
        t = q["topic"]
        row = topics.setdefault(
            t, {"total": 0, "solved": 0, "easy": 0, "medium": 0, "hard": 0}
        )
        row["total"] += 1
        if q["status"] == "solved":
            row["solved"] += 1
        if q["difficulty"] in row:
            row[q["difficulty"]] += 1

    weak_topics = []
    for topic, s in topics.items():
        if s["total"] > 0:
            pct = (s["solved"] / s["total"]) * 100
            if pct < 50:
                weak_topics.append({"topic": topic, "solved_pct": round(pct, 1), **s})

    total = len(questions)
    solved = sum(1 for q in questions if q["status"] == "solved")
    unsolved = sum(1 for q in questions if q["status"] == "unsolved")
    revisit = sum(1 for q in questions if q["status"] == "revisit")

    difficulty_breakdown = {
        d: {"total": 0, "solved": 0} for d in ("easy", "medium", "hard")
    }
    for q in questions:
        d = q["difficulty"]
        if d in difficulty_breakdown:
            difficulty_breakdown[d]["total"] += 1
            if q["status"] == "solved":
                difficulty_breakdown[d]["solved"] += 1

    recent_solved = sorted(
        [q for q in questions if q.get("solved_at")],
        key=lambda x: x["solved_at"],
        reverse=True,
    )[:5]

    return ok(data={
        "total": total,
        "solved": solved,
        "unsolved": unsolved,
        "revisit": revisit,
        "progress_pct": round((solved / total * 100) if total > 0 else 0, 1),
        "streak": _compute_streak(questions),
        "topics": topics,
        "weak_topics": sorted(weak_topics, key=lambda x: x["solved_pct"]),
        "difficulty_breakdown": difficulty_breakdown,
        "recent_solved": recent_solved,
    })


@app.get("/topics")
def topics(current=Depends(get_current_user)):
    data = load_data()
    qs = _user_questions(data, current["user_id"])
    return ok(data={"topics": sorted({q["topic"] for q in qs})})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
