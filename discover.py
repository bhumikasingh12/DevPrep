"""
LeetCode discovery module.

Calls the public LeetCode GraphQL endpoint to fetch the problem list and the
daily challenge. Results are cached in-memory for 10 minutes to stay polite
and keep the UI fast.

Note: LeetCode's GraphQL endpoint is not an officially documented public API,
but it is the same one leetcode.com uses in the browser. We identify ourselves
honestly via User-Agent and only hit it at most once per 10 minutes per query.
"""
from __future__ import annotations

import time
from typing import Any, Optional

import httpx

LEETCODE_GRAPHQL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "DevPrep/1.0 (educational interview prep tracker)",
    "Referer": "https://leetcode.com",
    "Origin": "https://leetcode.com",
}
CACHE_TTL_SECONDS = 600  # 10 minutes
REQUEST_TIMEOUT = 10.0

# { cache_key: (expires_at, value) }
_cache: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str) -> Optional[Any]:
    hit = _cache.get(key)
    if not hit:
        return None
    expires_at, value = hit
    if time.time() > expires_at:
        _cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.time() + CACHE_TTL_SECONDS, value)


# ── GraphQL helpers ─────────────────────────────────────────────────────────
async def _graphql(query: str, variables: dict) -> dict:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        res = await client.post(
            LEETCODE_GRAPHQL,
            headers=HEADERS,
            json={"query": query, "variables": variables},
        )
    res.raise_for_status()
    payload = res.json()
    if "errors" in payload:
        raise RuntimeError(str(payload["errors"]))
    return payload["data"]


# ── Problem list ────────────────────────────────────────────────────────────
PROBLEMS_QUERY = """
query problemsetQuestionList(
  $categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput
) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      acRate
      difficulty
      frontendQuestionId: questionFrontendId
      paidOnly: isPaidOnly
      title
      titleSlug
      topicTags { name slug }
    }
  }
}
"""


async def fetch_problems(
    skip: int = 0,
    limit: int = 30,
    difficulty: Optional[str] = None,  # "EASY" | "MEDIUM" | "HARD"
    search: Optional[str] = None,
    tag: Optional[str] = None,
) -> dict:
    """Paginated problem list with optional filters. Cached per query."""
    cache_key = f"problems:{skip}:{limit}:{difficulty}:{search}:{tag}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    filters: dict = {}
    if difficulty:
        filters["difficulty"] = difficulty.upper()
    if search:
        filters["searchKeywords"] = search
    if tag:
        filters["tags"] = [tag]

    data = await _graphql(
        PROBLEMS_QUERY,
        {"categorySlug": "", "skip": skip, "limit": limit, "filters": filters},
    )
    raw = data["problemsetQuestionList"]
    out = {
        "total": raw["total"],
        "questions": [_shape_problem(q) for q in raw["questions"]],
    }
    _cache_set(cache_key, out)
    return out


def _shape_problem(q: dict) -> dict:
    return {
        "frontend_id": q["frontendQuestionId"],
        "title": q["title"],
        "slug": q["titleSlug"],
        "difficulty": q["difficulty"].lower(),
        "acceptance_rate": round(float(q["acRate"]), 1),
        "paid_only": bool(q["paidOnly"]),
        "tags": [t["name"] for t in (q.get("topicTags") or [])],
        "url": f"https://leetcode.com/problems/{q['titleSlug']}/",
    }


# ── Daily challenge ─────────────────────────────────────────────────────────
DAILY_QUERY = """
query questionOfToday {
  activeDailyCodingChallengeQuestion {
    date
    link
    question {
      acRate
      difficulty
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      topicTags { name slug }
    }
  }
}
"""


async def fetch_daily() -> dict:
    cached = _cache_get("daily")
    if cached is not None:
        return cached

    data = await _graphql(DAILY_QUERY, {})
    node = data["activeDailyCodingChallengeQuestion"]
    q = node["question"]
    out = {
        "date": node["date"],
        "url": f"https://leetcode.com{node['link']}",
        "frontend_id": q["frontendQuestionId"],
        "title": q["title"],
        "slug": q["titleSlug"],
        "difficulty": q["difficulty"].lower(),
        "acceptance_rate": round(float(q["acRate"]), 1),
        "tags": [t["name"] for t in (q.get("topicTags") or [])],
    }
    _cache_set("daily", out)
    return out
