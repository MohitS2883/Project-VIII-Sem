import csv
import re
import json
import os
import requests
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from functools import lru_cache
import pymongo
from bson import ObjectId
import ollama
from dotenv import load_dotenv
import time
import jwt
import websocket
import threading
from datetime import datetime

load_dotenv()

# -------------------------------
# CONFIG
# -------------------------------
MODEL_NAME = "gemma3:4b"
CITIES_JSON = "cities.json"
MONGO_URI = os.getenv("MONGO_URI")
SERPER_API_KEY = os.getenv("APIKEY")
SERPER_ENDPOINT = os.getenv("APIENDPOINT")
USER_ID = "60b8d295f7f6d632d8b53cd4"

print(f"[DEBUG] SERPER_API_KEY: {SERPER_API_KEY}")
print(f"[DEBUG] SERPER_ENDPOINT: {SERPER_ENDPOINT}")
print(f"[DEBUG] MONGO_URI: {MONGO_URI}")

# -------------------------------
# TOOL FUNCTIONS
# -------------------------------

@lru_cache(maxsize=1)
def _load_cities() -> dict[str, str]:
    try:
        print("[DEBUG] Loading cities from file...")
        with open(CITIES_JSON, "r", encoding="utf-8") as f:
            cities = {k.title(): v for k, v in json.load(f).items()}
        print(f"[DEBUG] Loaded {len(cities)} cities")
        return cities
    except Exception as e:
        print(f"[ERROR] Failed to load cities: {e}")
        raise RuntimeError(f"City data error: {e}")

def city_code(city_name: str) -> str:
    code = _load_cities().get(city_name.title(), "UNK")
    print(f"[DEBUG] city_code('{city_name}') -> '{code}'")
    return code

def get_user_flight_bookings(user_id: str) -> list[dict]:
    try:
        print(f"[DEBUG] Fetching flight bookings for user_id={user_id}")
        client = pymongo.MongoClient(MONGO_URI)
        db = client["test"]
        bookings = list(db.flightbookings.find({"user": ObjectId(user_id)}))
        print(f"[DEBUG] Found {len(bookings)} bookings")
        serialized = [serialize_booking(b) for b in bookings]
        print(f"[DEBUG] Serialized bookings: {serialized}")
        return serialized
    except Exception as e:
        print(f"[ERROR] Error fetching flight bookings: {e}")
        return [{"error": str(e)}]

def flights_finder(departure_airport, arrival_airport, outbound_date, return_date=None, adults=1) -> str:
    print(f"[DEBUG] flights_finder called with: departure_airport={departure_airport}, arrival_airport={arrival_airport}, outbound_date={outbound_date}, return_date={return_date}, adults={adults}")

    if outbound_date in {"today", "tomorrow"}:
        delta = 0 if outbound_date == "today" else 1
        outbound_date = (datetime.now() + timedelta(days=delta)).strftime("%Y-%m-%d")
        print(f"[DEBUG] Normalized outbound_date to {outbound_date}")

    params = {
        "api_key": SERPER_API_KEY,
        "engine": "google_flights",
        "departure_id": departure_airport,
        "arrival_id": arrival_airport,
        "outbound_date": outbound_date,
        "return_date": return_date,
        "adults": adults,
        "currency": "USD",
        "type": "2" if return_date is None else "3",
    }
    print(f"[DEBUG] flights_finder params: {params}")

    try:
        res = requests.get(SERPER_ENDPOINT, params=params, timeout=15)
        print(f"[DEBUG] flights_finder HTTP status: {res.status_code}")
        res.raise_for_status()
        data = res.json()
        print(f"[DEBUG] flights_finder response data keys: {list(data.keys())}")
        flights = data.get("best_flights", [])[:5]
        print(f"[DEBUG] Retrieved {len(flights)} flights flights: {flights}")

        if not flights:
            return "Sorry, no flights found for your search."

        # Build a human-readable summary string
        summaries = []
        for i, flight_data in enumerate(flights, 1):
            legs = flight_data.get('flights', [])
            total_duration = flight_data.get('total_duration', 'N/A')
            price = flight_data.get('price', 'N/A')
            stops = len(legs) - 1

                # Format each leg in the journey
            leg_summaries = []
            for leg in legs:
                dep = leg['departure_airport']
                arr = leg['arrival_airport']
                airline = leg.get('airline', 'Unknown Airline')
                flight_no = leg.get('flight_number', 'N/A')
                dep_time = dep.get('time', 'N/A')
                arr_time = arr.get('time', 'N/A')
                duration = leg.get('duration', 'N/A')
                airplane = leg.get('airplane', 'N/A')

                leg_summary = (f"{airline} {flight_no} from {dep['id']} ({dep_time}) "
                                   f"to {arr['id']} ({arr_time}), Duration: {duration} mins, Plane: {airplane}")
                leg_summaries.append(leg_summary)

            stops_text = "Direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"
            summary = (f"Flight {i} - Price: ${price}, Total duration: {total_duration} mins, Stops: {stops_text}\n"
                           + "\n".join(leg_summaries))
            summaries.append(summary)
        result_str = "Here are some flight options:\n" + "\n".join(summaries)
        return result_str

    except Exception as e:
        print(f"[ERROR] flights_finder error: {e}")
        return f"Error fetching flights: {e}"

def hotels_finder(q, check_in_date, check_out_date, adults=1, rooms=1) -> str:
    print(f"[DEBUG] hotels_finder called with: q={q}, check_in_date={check_in_date}, check_out_date={check_out_date}, adults={adults}, rooms={rooms}")
    params = {
        "api_key": SERPER_API_KEY,
        "engine": "google_hotels",
        "q": q,
        "check_in_date": check_in_date,
        "check_out_date": check_out_date,
        "adults": adults,
        "rooms": rooms,
        "currency": "INR"
    }
    print(f"[DEBUG] hotels_finder params: {params}")

    try:
        res = requests.get(SERPER_ENDPOINT, params=params, timeout=15)
        print(f"[DEBUG] hotels_finder HTTP status: {res.status_code}")
        res.raise_for_status()
        data = res.json()
        print(f"[DEBUG] hotels_finder response data keys: {list(data.keys())}")
        properties = data.get("properties", [])[:5]
        print(f"[DEBUG] Retrieved {len(properties)} hotels")

        if not properties:
            return "Sorry, no hotels found for your search."

        summaries = []
        for i, hotel in enumerate(properties, 1):
            name = hotel.get('name', 'Unknown Hotel')
            type_ = hotel.get('type', 'N/A')
            link = hotel.get('link', 'No link available')
            price_lowest = hotel.get('rate_per_night', {}).get('lowest', 'N/A')
            total_price = hotel.get('total_rate', {}).get('lowest', 'N/A')
            check_in = hotel.get('check_in_time', 'N/A')
            check_out = hotel.get('check_out_time', 'N/A')
            rating = hotel.get('overall_rating', 'N/A')
            reviews = hotel.get('reviews', 0)
            location_rating = hotel.get('location_rating', 'N/A')
            amenities = hotel.get('amenities', [])
            essential_info = hotel.get('essential_info', [])
            nearby_places = hotel.get('nearby_places', [])

            # Format amenities string
            amenities_str = ', '.join(amenities) if amenities else 'No amenities info'

            # Format essential info
            essential_str = ', '.join(essential_info) if essential_info else 'No essential info'

            # Format nearby places string
            nearby_str = []
            for place in nearby_places:
                name_place = place.get('name', 'Unknown place')
                transports = place.get('transportations', [])
                transport_strs = []
                for t in transports:
                    transport_type = t.get('type', 'N/A')
                    duration = t.get('duration', 'N/A')
                    transport_strs.append(f"{transport_type} ({duration})")
                nearby_str.append(f"{name_place}: {', '.join(transport_strs)}")
            nearby_places_str = "\n  - ".join(nearby_str) if nearby_str else "No nearby places info"

            # Extract some images (thumbnails)
            images = hotel.get('images', [])
            image_thumbs = [img.get('thumbnail', '') for img in images[:3]]  # Show first 3 thumbnails
            images_str = "\n  ".join(image_thumbs) if image_thumbs else "No images available"

            summary = (
                f"Hotel {i}: {name} ({type_})\n"
                f"Link: {link}\n"
                f"Price per night: {price_lowest}, Total price: {total_price}\n"
                f"Check-in: {check_in}, Check-out: {check_out}\n"
                f"Overall Rating: {rating} ({reviews} reviews), Location rating: {location_rating}\n"
                f"Amenities: {amenities_str}\n"
                f"Essential Info: {essential_str}\n"
                f"Nearby Places:\n  - {nearby_places_str}\n"
                f"Sample Images:\n  - {images_str}\n"
            )
            summaries.append(summary)

        result_str = "Here are some hotel options:\n\n" + "\n".join(summaries)
        return result_str

    except Exception as e:
        print(f"[ERROR] hotels_finder error: {e}")
        return f"Error fetching hotels: {e}"

def create_flight_booking(user_id, name, from_city, to_city, airline, flightno, dateOfJourney, totalPrice, numberOfTickets=None):
    print(f"[DEBUG] create_flight_booking called with user_id={user_id}, name={name}, from={from_city}, to={to_city}, airline={airline}, flightno={flightno}, dateOfJourney={dateOfJourney}, totalPrice={totalPrice}, numberOfTickets={numberOfTickets}")
    try:
        journey_date = datetime.strptime(dateOfJourney, "%Y-%m-%d")
        print(f"[DEBUG] Parsed journey date: {journey_date}")
        if journey_date.date() < datetime.now(timezone.utc).date():
            error_msg = "Journey date cannot be in the past."
            print(f"[ERROR] {error_msg}")
            raise ValueError(error_msg)

        client = pymongo.MongoClient(MONGO_URI)
        db = client["test"]
        doc = {
            "user": ObjectId(user_id),
            "name": name,
            "from": from_city,
            "to": to_city,
            "airline": airline,
            "flightno": flightno,
            "dateOfJourney": journey_date,
            "totalPrice": totalPrice,
            "numberOfTickets": numberOfTickets,
            "bookedAt": datetime.utcnow(),
        }

        res = db.flightbookings.insert_one(doc)
        print(f"[DEBUG] Inserted booking with ID: {res.inserted_id}")
        return f"Booking confirmed! Your booking ID is {res.inserted_id}."
    except Exception as e:
        print(f"[ERROR] create_flight_booking error: {e}")
        return f"Error creating booking: {e}"

def serialize_booking(booking):
    serialized = {k: str(v) if isinstance(v, (ObjectId, datetime)) else v for k, v in booking.items()}
    print(f"[DEBUG] serialize_booking output: {serialized}")
    return serialized

# -------------------------------
# TOOL REGISTRY
# -------------------------------

TOOLS = {
    "city_code": city_code,
    "flights_finder": flights_finder,
    "hotels_finder": hotels_finder,
    "get_user_flight_bookings": get_user_flight_bookings,
    "create_flight_booking": create_flight_booking,
}

# -------------------------------
# JSON PARSER
# -------------------------------

def parse_function_call(text: str) -> Optional[Dict[str, Any]]:
    print(f"[DEBUG] parse_function_call input text: {text}")
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            print("[DEBUG] No JSON found in text")
            return None
        parsed = json.loads(text[start:end])
        print(f"[DEBUG] Parsed function call JSON: {parsed}")
        return parsed
    except Exception as e:
        print(f"[ERROR] JSON parse error: {e}")
        return None

# -------------------------------
# SYSTEM MESSAGE
# -------------------------------

today = datetime.now().strftime("%B %d, %Y")
SYSTEM_MSG = f"""
You are a helpful assistant. Today is {today}.
Please answer based on this current date.
You are a travel assistant. Respond in natural language, and if needed, emit a JSON function call like:
{{
  "name": "tool_name",
  "parameters": {{
    ...
  }}
}}
Available tools and their exact parameter names:

1. city_code:
   - city_name: string

2. flights_finder:
   - departure_airport: string (airport code, e.g. 'BLR')
   - arrival_airport: string (airport code, e.g. 'BOM')
   - outbound_date: string ('YYYY-MM-DD' or 'today' or 'tomorrow')
   - return_date: string or null (optional)
   - adults: integer (default 1)

3. hotels_finder:
   - q: string (location name)
   - check_in_date: string ('YYYY-MM-DD')
   - check_out_date: string ('YYYY-MM-DD')
   - adults: integer (default 1)
   - rooms: integer (default 1)

4. create_flight_booking:
   - user_id: string
   - name: string
   - from_city: string
   - to_city: string
   - airline: string
   - flightno: string
   - dateOfJourney: string ('YYYY-MM-DD')
   - totalPrice: float
   - numberOfTickets: integer (optional)

5. get_user_flight_bookings:
   - user_id: string (optional)
"""

def chat():
    print("🧭 Travel Assistant (with multiple tools)")
    print("Ask about flights, hotels, bookings, or city codes.\nType 'exit' to quit.\n")
    history = []

    while True:
        user_input = input("You: ")
        if user_input.lower() in {"exit", "quit"}:
            break

        history.append({"role": "user", "content": user_input})

        response = ollama.chat(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_MSG},
                *history,
                {"role": "user", "content": f"[user_id:{USER_ID}] {user_input}"},
            ]
        )

        content = response["message"]["content"]
        func_call = parse_function_call(content)

        if func_call and "name" in func_call and "parameters" in func_call:
            tool_name = func_call["name"]
            params = func_call["parameters"]
            print(f"[DEBUG] Calling tool: {tool_name} with params: {params}")

            if tool_name in TOOLS:
                try:
                    result = TOOLS[tool_name](**params)
                except Exception as e:
                    result = f"Error invoking tool {tool_name}: {e}"
            else:
                result = f"Unknown tool requested: {tool_name}"
            print(f"Assistant:\n{result}")
            history.append({"role": "assistant", "content": result})
        else:
            print(f"Assistant:\n{content}")
            history.append({"role": "assistant", "content": content})

def compute_response_relevance(query, response):
    query_words = set(re.findall(r"\b\w+\b", query.lower()))
    response_words = set(re.findall(r"\b\w+\b", response.lower()))
    return round(len(query_words & response_words) / len(query_words), 2) if query_words else 0.0

def test_travel_assistant_from_csv(filepath="tooltests.csv", output_filepath="test_results_ollama_gemma.csv"):
    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        test_cases = list(reader)

    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": SYSTEM_MSG},
            {"role": "user", "content": f"[user_id:{USER_ID}] What is today's date?"}
        ]
    )
    content = response["message"]["content"]
    print(f"Model response for today's date: {content}")


    with open(output_filepath, mode="w", encoding="utf-8", newline="") as out_file:
        fieldnames = [
            "query", "expected_tools", "tools_called",
            "status", "time_taken_sec", "response_relevance", "final_response"
        ]
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()

        for row in test_cases:
            query = row["query"]
            expected_tools_raw = row["expected_tools"].strip().lower()
            expected_tools = [] if expected_tools_raw == "none" else [t.strip() for t in expected_tools_raw.split(",")]

            print(f"🔍 Testing query: {query}")
            start_time = time.time()

            response = ollama.chat(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_MSG},
                    {"role": "user", "content": f"[user_id:{USER_ID}] {query}"}
                ]
            )
            end_time = time.time()
            content = response["message"]["content"]
            time_taken = round(end_time - start_time, 3)

            func_call = parse_function_call(content)
            tools_called = [func_call["name"]] if func_call and "name" in func_call else []

            if func_call and "name" in func_call and "parameters" in func_call:
                tool_name = func_call["name"]
                params = func_call["parameters"]
                if tool_name in TOOLS:
                    try:
                        final_response = TOOLS[tool_name](**params)
                    except Exception as e:
                        final_response = f"Error invoking tool {tool_name}: {e}"
                else:
                    final_response = f"Unknown tool requested: {tool_name}"
            else:
                final_response = content

            status = "PASS" if set(tools_called) == set(expected_tools) else "FAIL"
            relevance = compute_response_relevance(query, content)

            writer.writerow({
                "query": query,
                "expected_tools": ", ".join(expected_tools) if expected_tools else "none",
                "tools_called": ", ".join(tools_called) if tools_called else "none",
                "status": status,
                "time_taken_sec": time_taken,
                "response_relevance": relevance,
                "final_response": str(final_response).replace("\n", " ").replace("\r", " ")
            })

            print(f"✅ Result: {status} | Tools: {tools_called} | Relevance: {relevance}")

if __name__ == "__main__":
    test_travel_assistant_from_csv()
