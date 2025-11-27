"""
LLM wrapper for CustomerSimulator.

Provides pluggable backends for OpenAI and Claude.
"""

import os
from typing import Dict, Any
import openai


def create_openai_simulator_callable(model: str = "gpt-4o", temperature: float = 0.7):
    """
    Create an OpenAI-based customer simulator callable.

    Args:
        model: OpenAI model to use (e.g., "gpt-4o", "gpt-4o-mini")
        temperature: Sampling temperature (0.7 = varied, 0 = deterministic)

    Returns:
        Callable that can be passed to CustomerSimulator.llm_callable
    """
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def simulate_customer(payload: Dict[str, Any]) -> str:
        """
        Generate customer's next message based on persona and history.

        Payload structure:
            {
                "persona": {...},
                "bucket": "appointment_booking",
                "model_name": "gpt-4o",
                "history": [{"role": "customer", "content": "..."}, ...],
                "assistant_message": "..." (or None)
            }
        """
        persona = payload["persona"]
        history = payload["history"]

        # Build system prompt for customer simulator
        system_prompt = f"""You are roleplaying as a customer contacting a med spa via SMS.

**Your Profile:**
- Name: {persona['name']}
- Goal: {persona['goal']}
- Personality: {persona['personality']}
- Background: {persona['background']}

**Important Instructions:**
1. Act like a REAL customer - be natural, use casual language, minor typos are OK
2. Your goal is: {persona['goal']}
3. Respond naturally to the assistant's messages (1-3 sentences, like SMS)
4. Don't reveal you're an AI - stay in character
5. If your goal is achieved, you can end naturally ("great, thanks!" or "perfect!")
6. If you're uncertain about a service (like {persona['name']} persona), don't let the assistant push you into booking immediately

**Persona-Specific Behavior:**
{_get_persona_instructions(persona)}

Respond as the customer would. Just give the customer's next message, nothing else.
No meta-commentary, no explanations - only the customer's text message.
"""

        # Convert history to OpenAI format
        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history
        for msg in history:
            role = "assistant" if msg["role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})

        # Add prompt for next customer message
        messages.append({
            "role": "user",
            "content": "Generate the customer's next SMS message:"
        })

        # Call OpenAI
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=200,
            temperature=temperature
        )

        customer_message = response.choices[0].message.content.strip()

        # Remove quotes if LLM wrapped the message
        if customer_message.startswith('"') and customer_message.endswith('"'):
            customer_message = customer_message[1:-1]

        return customer_message

    return simulate_customer


def _get_persona_instructions(persona: Dict[str, Any]) -> str:
    """Get persona-specific behavioral instructions."""
    bucket = persona.get("bucket", "")
    prefs = persona.get("preferences", {})

    instructions = []

    if bucket == "information_seeking":
        if not prefs.get("ready_to_book_now"):
            instructions.append("- You're NOT ready to book yet - just gathering information")
            instructions.append("- If pushed to book, politely deflect: 'I'm just researching for now'")

    elif bucket == "appointment_booking":
        expects = prefs.get("expects", {})
        if expects.get("no_preemptive_check_for_vague_relative_time"):
            instructions.append("- Use vague time references like 'next week' or 'after work' occasionally")
        if "time_phrases" in prefs:
            instructions.append(f"- Use timing phrases like: {', '.join(prefs['time_phrases'][:3])}")

    elif bucket == "appointment_management":
        if prefs.get("often_omits_details"):
            instructions.append("- Be vague initially - say 'my appointment' without specifying which one")
            instructions.append("- Wait for clarification questions before providing details")

    elif bucket == "sales_conversion_support":
        if prefs.get("open_to_upsell"):
            instructions.append("- You're open to suggestions but not pushy sales tactics")
        if not prefs.get("expects", {}).get("no_medical_diagnosis"):
            instructions.append("- Ask for recommendations but don't expect medical advice")

    elif bucket == "post_appointment_support":
        instructions.append("- You recently had a treatment and have aftercare questions")
        instructions.append("- If symptoms sound serious, expect escalation to clinic")

    return "\n".join(instructions) if instructions else "Follow your goal naturally."
