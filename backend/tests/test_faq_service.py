from __future__ import annotations

from typing import List

from sqlalchemy.orm import Session

from database import FAQArticle
from faq_service import get_faq_answer


def _seed_faqs(db: Session) -> List[FAQArticle]:
    # Ensure a clean slate for each test run so slug uniqueness is not violated
    db.query(FAQArticle).delete()
    db.commit()

    articles: List[FAQArticle] = []

    articles.append(
        FAQArticle(
            slug="hours",
            question="What are your hours?",
            answer="We are open from 9am to 6pm Monday through Friday.",
            category="hours",
            tags=["hours", "open", "close"],
        )
    )
    articles.append(
        FAQArticle(
            slug="location",
            question="Where are you located?",
            answer="We are located at 123 Main St, Suite 200.",
            category="location",
            tags=["address", "location", "parking"],
        )
    )
    articles.append(
        FAQArticle(
            slug="botox_services",
            question="Do you offer Botox treatments?",
            answer="Yes, we offer Botox and other injectable treatments.",
            category="services",
            tags=["botox", "injectables", "services"],
        )
    )

    for article in articles:
        db.add(article)
    db.commit()

    return articles


def test_get_faq_answer_matches_hours_question(db_session: Session) -> None:
    _seed_faqs(db_session)

    result = get_faq_answer(db_session, query="What are your hours on Saturday?")

    assert result["success"] is True
    answer = result["answer"]
    assert answer["slug"] == "hours"
    assert "9am" in answer["answer"]


def test_get_faq_answer_handles_unknown_query(db_session: Session) -> None:
    _seed_faqs(db_session)

    result = get_faq_answer(db_session, query="Do you offer haircuts?")

    assert result["success"] is False
    assert "No matching" in result["error"]


def test_get_faq_answer_empty_query(db_session: Session) -> None:
    _seed_faqs(db_session)

    result = get_faq_answer(db_session, query="   ")

    assert result["success"] is False
    assert "Empty query" in result["error"]
