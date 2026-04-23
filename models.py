"""
Pydantic models for requests. DB records stay as plain dicts.
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

Difficulty = Literal["easy", "medium", "hard"]
Status = Literal["solved", "unsolved", "revisit"]


# Auth 
class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


# Questions 
class QuestionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    topic: str = Field(..., min_length=1, max_length=80)
    difficulty: Difficulty
    status: Status = "unsolved"
    notes: str = ""
    tags: List[str] = []
    leetcode_url: Optional[str] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v: List[str]) -> List[str]:
        return [t.strip() for t in v if t and t.strip()]


class QuestionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    topic: Optional[str] = Field(default=None, min_length=1, max_length=80)
    difficulty: Optional[Difficulty] = None
    status: Optional[Status] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    leetcode_url: Optional[str] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    attempts: Optional[int] = Field(default=None, ge=0)

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        return [t.strip() for t in v if t and t.strip()]
