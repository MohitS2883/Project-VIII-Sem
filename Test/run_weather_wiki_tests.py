import csv
import time
import re
from weatherbot import agent_with_chat_history

def extract_tool_name(agent_output):
    match = re.search(r'"action"\s*:\s*"([^"]+)"', agent_output)
    return match.group(1) if match else "Final Answer"

def run_weather_wiki_tests(input_csv, output_csv):
    with open(input_csv, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        test_cases = list(reader)

    with open(output_csv, mode="w", encoding="utf-8", newline="") as out_file:
        fieldnames = ["query", "expected_tool", "actual_tool", "status", "time_taken_sec", "final_response"]
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()

        for test in test_cases:
            query = test["query"]
            expected = test["expected_tool"]

            start = time.time()
            result = agent_with_chat_history.invoke(
                {"input": query},
                config={"configurable": {"session_id": "test"}}
            )
            end = time.time()

            full_response = result.get("output", "")
            actual_tool = extract_tool_name(full_response)
            status = "PASS" if actual_tool == expected else "FAIL"

            writer.writerow({
                "query": query,
                "expected_tool": expected,
                "actual_tool": actual_tool,
                "status": status,
                "time_taken_sec": round(end - start, 3),
                "final_response": full_response.replace("\n", " ")
            })

    print("Tests completed. Results saved to", output_csv)

if __name__ == "__main__":
    run_weather_wiki_tests("weather_wiki_test_cases.csv", "weather_wiki_results_google.csv")
