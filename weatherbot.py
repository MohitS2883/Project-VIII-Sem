import os
from langchain_ibm import WatsonxLLM
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.prompts import PromptTemplate
from langchain.tools import tool
from langchain.tools.render import render_text_description_and_args
from langchain.agents.output_parsers import JSONAgentOutputParser
from langchain.agents.format_scratchpad import format_log_to_str
from langchain.agents import AgentExecutor
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.runnables import RunnablePassthrough
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
from pydantic import BaseModel, Field
import requests
from urllib.parse import quote  # For URL encoding city names
from langchain.tools import Tool
import time
import json
import threading
import jwt
import websocket
from langchain_ibm import ChatWatsonx
from dotenv import load_dotenv
load_dotenv()

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

template = "Answer the {input} accurately. If you do not know the answer, simply say you do not know."
prompt = PromptTemplate.from_template(template)

agent = prompt | llm

class WikipediaQuerySchema(BaseModel):
    query: str = Field(..., description="The search query for Wikipedia.")

class WikipediaTool:
    def get_tool(self):
        api_wrapper = WikipediaAPIWrapper(top_k_results=4, doc_content_chars_max=100)
        tool = WikipediaQueryRun(
            api_wrapper=api_wrapper,
            args_schema=WikipediaQuerySchema,  # Ensure this is a subclass of BaseModel
            description="Use this tool to get attractions of a city."
        )
        return tool

class OpenMeteoTool:
    def get_coordinates(self, city_name):
        # URL encode the city name to handle spaces and special characters
        encoded_city_name = quote(city_name)

        geocode_url = f"https://nominatim.openstreetmap.org/search?q={encoded_city_name}&format=json"

        headers = {
            'User-Agent': 'MyWeatherApp/1.0 (Geocoding and Weather Service)'  # Generic app description
        }

        response = requests.get(geocode_url, headers=headers)

        if response.status_code == 200:
            data = response.json()

            if data:
                latitude = data[0].get('lat')
                longitude = data[0].get('lon')

                # Ensure latitude and longitude were found
                if latitude and longitude:
                    return latitude, longitude
                else:
                    raise ValueError(f"Coordinates not found for '{city_name}'.")
            else:
                raise ValueError(f"No data returned for city '{city_name}'.")
        else:
            raise Exception(f"Nominatim API returned an error: {response.status_code}")

    def get_weather(self, city_name):
        try:
            # Fetch coordinates using the get_coordinates method
            lat, lon = self.get_coordinates(city_name)

            # Fetch weather information from Open-Meteo API using the coordinates
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
            weather_response = requests.get(weather_url)

            if weather_response.status_code == 200:
                weather_data = weather_response.json()
                current_weather = weather_data.get('current_weather')

                if current_weather:
                    response = f"Current temperature in {city_name} is {current_weather['temperature']}°C, with wind speed of {current_weather['windspeed']} m/s and it is { 'day' if current_weather['is_day'] == 1 else 'night'} time."
                    return response
                else:
                    raise Exception("Weather data not available.")
            else:
                raise Exception(f"Open-Meteo API returned an error: {weather_response.status_code}")
        except Exception as e:
            return str(e)

    def get_tool(self):
        return Tool.from_function(
            func=self.get_weather,
            name="OpenMeteoTool",
            description="Use this tool to get weather information of a city."
        )

tools = [WikipediaTool().get_tool(), OpenMeteoTool().get_tool()]

system_prompt = """
Todays Date: 19 Feb 2025
Respond to the human as helpfully and accurately as possible.
You have access to the following tools:
{tools}

Use a json blob to specify a tool by providing an action key (tool name) and an action_input key (tool input).
Valid "action" values: "Final Answer" or {tool_names}
Provide only ONE action per $JSON_BLOB, as shown:"
```
{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}
```
Follow this format:
Question: input question to answer
Thought: consider previous and subsequent steps
Action:
```
$JSON_BLOB
```
Observation: action result
... (repeat Thought/Action/Observation N times)
Thought: I know what to respond
Action:
```
{{
  "action": "Final Answer",
  "action_input": "Final response to human"
}}
Begin! Reminder to ALWAYS respond with a valid json blob of a single action.
Respond directly if appropriate. Format is Action:```$JSON_BLOB```then Observation"""

human_prompt = """{input}
{agent_scratchpad}
(reminder to always respond in a JSON blob)"""

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system_prompt),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", human_prompt),
    ]
)

prompt = prompt.partial(
    tools=render_text_description_and_args(list(tools)),
    tool_names=", ".join([t.name for t in tools]),
)

message_history = ChatMessageHistory()

chain = (
    RunnablePassthrough.assign(
        agent_scratchpad=lambda x: format_log_to_str(x["intermediate_steps"]),
    )
    | prompt
    | llm
    | JSONAgentOutputParser()
)

agent_executor_chat = AgentExecutor(
    agent=chain, tools=tools, handle_parsing_errors=True, verbose=True
)

agent_with_chat_history = RunnableWithMessageHistory(
    agent_executor_chat,
    get_session_history=lambda session_id: message_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)

answer1 = agent_with_chat_history.invoke(
        {"input": "How is the weather in New York?"},
        config={"configurable": {"session_id": "watsonx"}}
)

print(answer1['output'])

answer2 = agent_with_chat_history.invoke(
        {"input": "I will be landing in New York today. I want to know what kind of cloths to carry."},
        config={"configurable": {"session_id": "watsonx"}}
)

print(answer2['output'])

JWT_SECRET = 'NOIDEAABRO'

# User info (use the same userId and username that exist in your MongoDB)
USER_ID = "665003a8c92f0a1c98d49f03"
USERNAME = "weather-bot"

# Generate JWT token (no expiration or custom options here)
payload = {
    "userId": USER_ID,
    "username": USERNAME,
    "iat": int(time.time())  # issued at time
}
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

print("Generated token:", token)

def on_message(ws, message):
    print("Received:", message)

    try:
        data = json.loads(message)  # parse the JSON string

        # Check if this message has a 'type' field
        has_type = "type" in data

        # If it has sender, recipient, and text (a "chat" message)
        if 'sender' in data and 'recipient' in data and 'text' in data:
            out = agent_with_chat_history.invoke(
                {"input": data["text"]},
                config={"configurable": {"session_id": "watsonx"}}
            )

            # Build the response, optionally include 'type' if present
            response = {
                "sender": USER_ID,
                "recipient": data["sender"],
                "text": out["output"],
                "_id": "temp-id-" + str(time.time())
            }
            if has_type:
                response["type"] = data["type"]

            ws.send(json.dumps(response))
            print("Replied with message",response)
        else:
            # Handle other types of messages (like the initial online list)
            print("Message does not contain sender/recipient/text fields, ignoring or handling separately.")

    except Exception as e:
        print("Error parsing or handling message:", e)


def on_open(ws):
    print("WebSocket connected")

def on_error(ws, error):
    print("Error:", error)

def on_close(ws, close_status_code, close_msg):
    print("WebSocket closed")

def connect_ws():
    while True:
        try:
            ws = websocket.WebSocketApp(
                "ws://localhost:3000",
                header={ "Cookie": f"token={token}" },
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )

            ws.run_forever()

        except Exception as e:
            print("WebSocket connection error:", e)

        print("Disconnected. Reconnecting in 1 second...")
        time.sleep(1)  # Wait before reconnecting

if __name__ == "__main__":
    threading.Thread(target=connect_ws, daemon=True).start()
    input("Press Enter to quit...\n")