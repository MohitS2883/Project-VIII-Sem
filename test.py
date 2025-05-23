from __future__ import annotations
import jwt
import websocket
import threading
import json
import time
import os, re, requests
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, TypedDict
from functools import lru_cache

from pydantic import BaseModel, Field

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import tools_condition

from langchain_ibm import ChatWatsonx
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams
from dotenv import load_dotenv
load_dotenv()


### ===== MODEL SETUP =====

credentials = {
    "url": os.getenv("URL"),
    "apikey": os.getenv("CHATKEY"),
}
project_id = os.getenv("PROJECT_ID")

llm = ChatWatsonx(
    model_id="ibm/granite-3-2-8b-instruct",
    url=credentials["url"],
    apikey=credentials["apikey"],
    project_id=project_id,
    params={GenParams.DECODING_METHOD: "sample", GenParams.TEMPERATURE: 0.2},
)


SERPER_API_KEY = os.getenv("APIKEY")
SERPER_ENDPOINT = os.getenv("APIENDPOINT")

class FlightsInput(BaseModel):
    departure_airport: str = Field(description="IATA code (e.g. BLR)")
    arrival_airport:   str = Field(description="IATA code (e.g. BOM)")
    outbound_date:     str = Field(description="'YYYY-MM-DD', 'today', or 'tomorrow'")
    return_date: Optional[str] = None
    adults:      Optional[int] = 1


class HotelsInput(BaseModel):
    q: str = Field(description="City or area (e.g. Singapore)")
    check_in_date:  str
    check_out_date: str
    adults: Optional[int] = 1
    rooms:  Optional[int] = 1

def _call_serpapi(payload: Dict[str, Any]) -> Dict[str, Any]:
    r = requests.get(SERPER_ENDPOINT, params=payload, timeout=20)
    r.raise_for_status()
    return r.json()

CITIES_JSON = "cities.json"

@lru_cache(maxsize=1)
def _load_cities() -> dict[str, str]:
    """Load once and memoise."""
    try:
        with open(CITIES_JSON, "r", encoding="utf-8") as f:
            return {k.title(): v for k, v in json.load(f).items()}
    except FileNotFoundError:
        raise RuntimeError(f"{CITIES_JSON} not found")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"{CITIES_JSON} is not valid JSON: {e}")

def get_city_acronym(city_name: str) -> str:
    """
    Return IATA code for a given city name (case-insensitive).
    Example: 'Bengaluru' -> 'BLR'
    """
    return _load_cities().get(city_name.title(), "UNK")

@tool
def city_code(city_name: str) -> str:
    """
    Look up the 3-letter airport code (IATA) for a city name.
    If the city is unknown, returns 'UNK'.
    """
    return get_city_acronym(city_name)


@tool
def flights_finder(
    departure_airport: str,
    arrival_airport: str,
    outbound_date: str,
    return_date: Optional[str] = None,
    adults: int = 1,
) -> List[Dict[str, Any]]:
    """
    Look up flights (Google Flights via SerpAPI).

    outbound_date may be 'YYYY-MM-DD', 'today', or 'tomorrow'.
    """
    if outbound_date in {"today", "tomorrow"}:
        delta = 0 if outbound_date == "today" else 1
        outbound_date = (
            datetime.now() + timedelta(days=delta)
        ).strftime("%Y-%m-%d")

    payload = {
        "api_key": SERPER_API_KEY,
        "engine": "google_flights",
        "departure_id": departure_airport,
        "arrival_id":   arrival_airport,
        "outbound_date": outbound_date,
        "return_date":   return_date,
        "adults":        adults,
        "currency":      "USD",
        "type": "2" if return_date is None else "3",
    }
    try:
        r = requests.get(SERPER_ENDPOINT, params=payload, timeout=20)
        r.raise_for_status()
        return r.json().get("best_flights", [])[:5]
    except Exception as e:
        return [{"error": str(e)}]


@tool
def hotels_finder(
    q: str,
    check_in_date: str,
    check_out_date: str,
    adults: int = 1,
    rooms: int = 1,
) -> List[Dict[str, Any]]:
    """
    Look up hotels (Google Hotels via SerpAPI).
    """
    payload = {
        "api_key": SERPER_API_KEY,
        "engine": "google_hotels",
        "q": q,
        "check_in_date":  check_in_date,
        "check_out_date": check_out_date,
        "adults": adults,
        "rooms":  rooms,
        "currency": "INR",
    }
    try:
        r = requests.get(SERPER_ENDPOINT, params=payload, timeout=20)
        r.raise_for_status()
        return r.json().get("properties", [])[:5]
    except Exception as e:
        return [{"error": str(e)}]


TOOLS = {t.name: t for t in (flights_finder, hotels_finder , city_code)}
llm_with_tools = llm.bind_tools(list(TOOLS.values()))


SYSTEM_MSG = SystemMessage(
    content=(
        "You are a travel assistant. "
        "Always use colon ':' after labels when presenting information, never 'at'. "
        "For example, say 'Flight details: ...' and not 'Flight details at ...'. "
        "• If the user gives city names, first call the city_code tool to get the IATA codes, "
        "  then pass those codes to flights_finder.\n"
        "• If the user already provides 3‑letter codes, skip city_code.\n"
        "• For hotel queries use hotels_finder.\n"
    )
)

class GState(TypedDict):
    messages: List[HumanMessage | AIMessage | ToolMessage]

def chat(state: GState) -> GState:
    """
        Call Granite WITH tools already bound, so the model can decide to
        emit `tool_calls` in its AIMessage.
    """
    ai = llm_with_tools.invoke(state["messages"])
    print("AI message tool_calls:", getattr(ai, "tool_calls", None))  # DEBUG LOG
    return {"messages": state["messages"] + [ai]}


def run_tools(state: GState) -> GState:
    msgs   = state["messages"]
    ai_msg = msgs[-1]
    new    = msgs.copy()

    for call in ai_msg.tool_calls or []:
        name = call["name"]
        args = call["args"]
        call_id = call["id"]

        print(f"Running tool: {name} with args: {args}")
        fn = TOOLS.get(name)
        result = fn.invoke(args) if fn else {"error": f"unknown tool {name}"}

        new.append(
            ToolMessage(
                name=name,
                tool_call_id=call_id,
                content=json.dumps(result, ensure_ascii=False)
            )
        )

    return {"messages": new}


graph = StateGraph(GState)

graph.add_node("chat",  chat)
graph.add_node("tools", run_tools)

def needs_tool(state: GState) -> str:
    last = state["messages"][-1]
    return "need_tool" if getattr(last, "tool_calls", None) else "done"

graph.add_conditional_edges(
    "chat",
    needs_tool,
    {"need_tool": "tools", "done": END},
)

graph.add_edge("tools", "chat")
graph.set_entry_point("chat")

assistant = graph.compile()

JWT_SECRET = 'NOIDEAABRO'

USER_ID = "60b8d295f7f6d632d8b53cd4"
USERNAME = "python-bot"

payload = {
    "userId": USER_ID,
    "username": USERNAME,
    "iat": int(time.time())
}
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

print("Generated token:", token)


import csv

def load_test_cases_from_csv(filepath: str) -> List[Dict[str, Any]]:
    test_cases = []
    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            expected_tools = [tool.strip() for tool in row["expected_tools"].split(",")]
            test_cases.append({
                "query": row["query"],
                "expected_tools": expected_tools,
                "expected_content_keywords": []
            })
    return test_cases


def test_travel_assistant_from_csv(filepath: str):
    test_cases = load_test_cases_from_csv(filepath)

    for test_case in test_cases:
        print(f"\nTesting query: {test_case['query']}")
        initial_state = {"messages": [SYSTEM_MSG, HumanMessage(content=test_case["query"])]}

        result = assistant.invoke(initial_state)
        messages = result["messages"]

        # Find AI messages
        ai_messages = [m for m in messages if isinstance(m, AIMessage)]
        ai_message_with_tools = ai_messages[-2] if len(ai_messages) >= 2 else ai_messages[-1]

        tools_called = [call["name"] for call in getattr(ai_message_with_tools, "tool_calls", [])]

        print("Tools called by AI:", tools_called)

        for expected_tool in test_case["expected_tools"]:
            assert expected_tool in tools_called, f"Expected tool '{expected_tool}' not called"

        print("Test passed: Correct tools were called.")


if __name__ == "__main__":
    test_travel_assistant_from_csv("tooltests.csv")
