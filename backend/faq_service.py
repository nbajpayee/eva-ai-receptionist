from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from database import FAQArticle


@dataclass
class FAQAnswer:
    slug: str
    question: str
    answer: str
    category: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "question": self.question,
            "answer": self.answer,
            "category": self.category,
        }


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).lower()


def _tokenize(value: str) -> List[str]:
    """Tokenize text into simple word tokens.

    We strip punctuation and lower-case so that queries like
    "What are your hours on Saturday?" and article questions align
    on shared content words (e.g. "hours").
    """

    normalized = _normalize_text(value)
    return re.findall(r"\w+", normalized)


# Very small set of generic stopwords that should not drive FAQ matching.
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "can",
    "could",
    "do",
    "does",
    "for",
    "from",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "shall",
    "should",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "us",
    "we",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
    "would",
    "you",
    "your",
    # Generic verbs that occur in many FAQ questions and should not
    # drive matching on their own.
    "offer",
    "offers",
    "offering",
}


def _score_article(query_tokens: List[str], article: FAQArticle) -> int:
    """Simple heuristic scoring for FAQ relevance.

    Higher score = better match. This is intentionally lightweight and
    deterministic so we can run it inside tool handlers without extra
    model calls.
    """

    score = 0
    question_text = _normalize_text(article.question)
    slug_text = _normalize_text(article.slug or "")

    # Exact slug match gets a big boost
    joined_query = " ".join(query_tokens)
    if slug_text and joined_query == slug_text:
        score += 50

    # Token overlap in question text, ignoring generic stopwords so that
    # unrelated questions like "Do you offer haircuts?" do not match a
    # generic "Do you offer Botox treatments?" FAQ.
    for token in query_tokens:
        if not token or token in _STOPWORDS:
            continue
        if token in question_text:
            score += 5

    return score


def get_faq_answer(
    db: Session,
    query: str,
    *,
    category: Optional[str] = None,
    max_candidates: int = 50,
) -> Dict[str, Any]:
    """Return the best-matching FAQArticle for a natural language query.

    This is used by conversational tools (voice + messaging) to provide a
    structured, policy-safe answer for common questions.
    """

    normalized_query = _normalize_text(query)
    if not normalized_query:
        return {
            "success": False,
            "error": "Empty query",
        }

    query_tokens = _tokenize(normalized_query)
    if not query_tokens:
        return {
            "success": False,
            "error": "Empty query",
        }

    q = db.query(FAQArticle).filter(FAQArticle.is_active.is_(True))
    if category:
        q = q.filter(FAQArticle.category == category)

    # Keep this bounded; FAQ corpus should be small but we are defensive.
    articles: List[FAQArticle] = (
        q.order_by(FAQArticle.display_order, FAQArticle.created_at.desc())
        .limit(max_candidates)
        .all()
    )

    if not articles:
        return {
            "success": False,
            "error": "No FAQ articles configured",
        }

    best: Optional[FAQArticle]
    best = None
    best_score = 0

    for article in articles:
        score = _score_article(query_tokens, article)
        if score > best_score:
            best_score = score
            best = article

    if not best or best_score <= 0:
        return {
            "success": False,
            "error": "No matching FAQ answer found",
        }

    answer = FAQAnswer(
        slug=best.slug,
        question=best.question,
        answer=best.answer,
        category=best.category,
    )

    return {
        "success": True,
        "answer": answer.to_dict(),
    }
