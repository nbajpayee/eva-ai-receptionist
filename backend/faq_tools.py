"""Shared OpenAI tool definitions for FAQ flows."""

from __future__ import annotations

from typing import Any, Dict, List


def get_faq_tools() -> List[Dict[str, Any]]:
    """Return FAQ-related tool definitions for conversational agents.

    These are lightweight utilities that let the model fetch a
    structured, policy-safe answer to common questions (hours, location,
    services, pricing, providers, policies, etc.).
    """

    return [
        {
            "type": "function",
            "function": {
                "name": "get_faq_answer",
                "description": (
                    "Look up a concise, policy-safe FAQ answer for common questions "
                    "about services, pricing, hours, providers, location, and policies."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": (
                                "The customer's question in natural language, for example "
                                "'What are your hours on Saturday?' or 'Do you offer Botox?'."
                            ),
                        },
                        "category": {
                            "type": "string",
                            "description": (
                                "Optional high-level category hint such as 'services', "
                                "'pricing', 'hours', 'location', or 'policies'."
                            ),
                            "enum": [
                                "services",
                                "pricing",
                                "hours",
                                "location",
                                "providers",
                                "policies",
                                "general",
                            ],
                        },
                    },
                    "required": ["query"],
                },
            },
        }
    ]
