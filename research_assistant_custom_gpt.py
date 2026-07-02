"""
AI Research Strategist - Custom GPT Agent
Provider-agnostic (Groq / OpenAI / Claude swappable)
"""

import os
from abc import ABC, abstractmethod
from dotenv import load_dotenv

load_dotenv()

# =========================================================
# 🧠 SYSTEM PROMPT (YOUR CUSTOM GPT PERSONA)
# =========================================================

AGENT_SYSTEM_PROMPT = """
Name: "AI Research Strategist"
Description: "Expert in synthetic user interviews with critical evaluation of AI limitations"

Instructions:
Always flag potential AI biases, remind me to validate with real users,
and focus on actionable insights over generic responses

Key Capabilities:
- Conduct synthetic interviews with personas
- Identify patterns while noting limitations
- Generate real user validation plans
- Create data collection strategies
"""


# =========================================================
# 🔌 LLM PROVIDER INTERFACE (ABSTRACTION LAYER)
# 👉 THIS is what makes Groq/OpenAI/Claude interchangeable
# =========================================================

class LLMProvider(ABC):
    @abstractmethod
    def chat(self, messages: list[dict]) -> str:
        pass


# =========================================================
# 🔥 GROQ IMPLEMENTATION (ACTIVE PROVIDER)
# =========================================================

from groq import Groq

class GroqProvider(LLMProvider):
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def chat(self, messages: list[dict]) -> str:
        response = self.client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.7,
        )
        return response.choices[0].message.content


# =========================================================
# 🟦 OPENAI IMPLEMENTATION (SWAPPABLE - NOT ACTIVE)
# =========================================================

class OpenAIProvider(LLMProvider):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def chat(self, messages: list[dict]) -> str:
        response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
        )
        return response.choices[0].message.content


# =========================================================
# 🟪 CLAUDE IMPLEMENTATION (SWAPPABLE - NOT ACTIVE)
# =========================================================

class ClaudeProvider(LLMProvider):
    def __init__(self):
        from anthropic import Anthropic
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    def chat(self, messages: list[dict]) -> str:
        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            messages=messages,
            max_tokens=1024,
        )
        return response.content[0].text


# =========================================================
# 🤖 CUSTOM GPT AGENT CORE
# =========================================================

class AIAgent:
    def __init__(self, llm: LLMProvider):
        self.llm = llm
        self.messages = [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT}
        ]

    def ask(self, user_input: str) -> str:
        self.messages.append({"role": "user", "content": user_input})

        response = self.llm.chat(self.messages)

        self.messages.append({"role": "assistant", "content": response})
        return response


# =========================================================
# 🚀 MAIN APP (CLI)
# =========================================================

if __name__ == "__main__":

    # =====================================================
    # 🔁 SWAP LLM PROVIDER HERE (ONLY CHANGE THIS SECTION)
    # =====================================================

    llm = GroqProvider()

    # 👉 FUTURE OPTIONS:
    # llm = OpenAIProvider()
    # llm = ClaudeProvider()

    agent = AIAgent(llm)

    print("\nAI Research Strategist ready. Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ")

        if user_input.lower() in ["exit", "quit"]:
            break

        response = agent.ask(user_input)
        print("\nAgent:", response, "\n")