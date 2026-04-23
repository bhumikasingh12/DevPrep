from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from datetime import datetime

app = FastAPI(title="DevPrep API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "data.json"

def load_data():
    if not os.path.exists(DATA_FILE):
        default = {
            "questions": [],
            "stats": {
                "total_solved": 0,
                "total_unsolved": 0,
                "streak": 0,
                "last_solved_date": None
            }
        }
        save_data(default)
        return default
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

class Question(BaseModel):
    id: Optional[str] = None
    title: str
    topic: str
    difficulty: str  # easy / medium / hard
    status: str = "unsolved"  # solved / unsolved / revisit
    notes: str = ""
    tags: List[str] = []
    leetcode_url: Optional[str] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    created_at: Optional[str] = None
    solved_at: Optional[str] = None
    attempts: int = 0

class UpdateQuestion(BaseModel):
    title: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    leetcode_url: Optional[str] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    attempts: Optional[int] = None

@app.get("/")
def root():
    return {"message": "DevPrep API is running 🚀", "version": "1.0.0"}

@app.get("/questions")
def get_questions(topic: Optional[str] = None, difficulty: Optional[str] = None, status: Optional[str] = None):
    data = load_data()
    questions = data["questions"]
    if topic:
        questions = [q for q in questions if q["topic"].lower() == topic.lower()]
    if difficulty:
        questions = [q for q in questions if q["difficulty"].lower() == difficulty.lower()]
    if status:
        questions = [q for q in questions if q["status"].lower() == status.lower()]
    return {"questions": questions, "total": len(questions)}

@app.post("/questions")
def add_question(q: Question):
    data = load_data()
    import uuid
    q.id = str(uuid.uuid4())[:8]
    q.created_at = datetime.now().isoformat()
    data["questions"].append(q.dict())
    save_data(data)
    return {"message": "Question added!", "question": q.dict()}

@app.put("/questions/{question_id}")
def update_question(question_id: str, update: UpdateQuestion):
    data = load_data()
    for i, q in enumerate(data["questions"]):
        if q["id"] == question_id:
            update_dict = {k: v for k, v in update.dict().items() if v is not None}
            if update_dict.get("status") == "solved" and q["status"] != "solved":
                update_dict["solved_at"] = datetime.now().isoformat()
            data["questions"][i].update(update_dict)
            save_data(data)
            return {"message": "Updated!", "question": data["questions"][i]}
    raise HTTPException(status_code=404, detail="Question not found")

@app.delete("/questions/{question_id}")
def delete_question(question_id: str):
    data = load_data()
    original = len(data["questions"])
    data["questions"] = [q for q in data["questions"] if q["id"] != question_id]
    if len(data["questions"]) == original:
        raise HTTPException(status_code=404, detail="Question not found")
    save_data(data)
    return {"message": "Deleted!"}

@app.get("/analytics")
def get_analytics():
    data = load_data()
    questions = data["questions"]
    
    topics = {}
    for q in questions:
        t = q["topic"]
        if t not in topics:
            topics[t] = {"total": 0, "solved": 0, "easy": 0, "medium": 0, "hard": 0}
        topics[t]["total"] += 1
        if q["status"] == "solved":
            topics[t]["solved"] += 1
        topics[t][q["difficulty"]] = topics[t].get(q["difficulty"], 0) + 1

    weak_topics = []
    for topic, stats in topics.items():
        if stats["total"] > 0:
            pct = (stats["solved"] / stats["total"]) * 100
            if pct < 50:
                weak_topics.append({"topic": topic, "solved_pct": round(pct, 1), **stats})

    total = len(questions)
    solved = len([q for q in questions if q["status"] == "solved"])
    unsolved = len([q for q in questions if q["status"] == "unsolved"])
    revisit = len([q for q in questions if q["status"] == "revisit"])

    difficulty_breakdown = {
        "easy": {"total": 0, "solved": 0},
        "medium": {"total": 0, "solved": 0},
        "hard": {"total": 0, "solved": 0},
    }
    for q in questions:
        d = q["difficulty"]
        if d in difficulty_breakdown:
            difficulty_breakdown[d]["total"] += 1
            if q["status"] == "solved":
                difficulty_breakdown[d]["solved"] += 1

    return {
        "total": total,
        "solved": solved,
        "unsolved": unsolved,
        "revisit": revisit,
        "progress_pct": round((solved / total * 100) if total > 0 else 0, 1),
        "topics": topics,
        "weak_topics": sorted(weak_topics, key=lambda x: x["solved_pct"]),
        "difficulty_breakdown": difficulty_breakdown,
        "recent_solved": sorted(
            [q for q in questions if q.get("solved_at")],
            key=lambda x: x["solved_at"],
            reverse=True
        )[:5]
    }

@app.get("/topics")
def get_topics():
    data = load_data()
    topics = list(set(q["topic"] for q in data["questions"]))
    return {"topics": sorted(topics)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)