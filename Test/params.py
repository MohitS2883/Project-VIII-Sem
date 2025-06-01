import pandas as pd

# Load the CSV
df = pd.read_csv("test_results_ollama_gemma_enhanced.csv")

# Normalize tools columns
df["expected_tools"] = df["expected_tools"].fillna("none")
df["tools_called"] = df["tools_called"].fillna("none")

# ========== BASIC METRICS ==========
avg_time = df["time_taken_sec"].mean()
avg_response_relevance = df["response_relevance"].mean()
avg_semantic_relevance = df["semantic_relevance"].mean()

pass_count = (df["status"] == "PASS").sum()
fail_count = (df["status"] == "FAIL").sum()
pass_fail_ratio = round(pass_count / (fail_count if fail_count else 1), 2)

print("\n=== Basic Metrics ===")
print(f"Average Time Taken (sec): {avg_time:.2f}")
print(f"Average Response Relevance (word-based): {avg_response_relevance:.2f}")
print(f"Average Semantic Relevance (embedding-based): {avg_semantic_relevance:.2f}")
print(f"Pass: {pass_count}, Fail: {fail_count}, Pass/Fail Ratio: {pass_fail_ratio}")

# ========== TOOL-WISE METRICS ==========
print("\n=== Per Tool Breakdown (Pass Rate) ===")
print(df.groupby("expected_tools")["status"].value_counts(normalize=True).unstack(fill_value=0))

print("\n=== Avg Time per Tool ===")
print(df.groupby("expected_tools")["time_taken_sec"].mean())

print("\n=== Avg Relevance per Tool ===")
print(df.groupby("expected_tools")[["response_relevance", "semantic_relevance"]].mean())

# ========== ADVANCED TOOL PRECISION/RECALL ==========
def calculate_tool_metrics(row):
    expected = set(row["expected_tools"].split(", ")) if row["expected_tools"] != "none" else set()
    called = set(row["tools_called"].split(", ")) if row["tools_called"] != "none" else set()
    correct = expected & called
    precision = len(correct) / len(called) if called else 1.0  # If nothing was called, consider precision = 1
    recall = len(correct) / len(expected) if expected else 1.0  # If nothing expected, recall = 1
    return pd.Series([precision, recall])

df[["tool_precision", "tool_recall"]] = df.apply(calculate_tool_metrics, axis=1)
df["tool_f1"] = 2 * (df["tool_precision"] * df["tool_recall"]) / (df["tool_precision"] + df["tool_recall"] + 1e-9)

print("\n=== Average Tool Precision/Recall/F1 ===")
print(f"Precision: {df['tool_precision'].mean():.2f}")
print(f"Recall:    {df['tool_recall'].mean():.2f}")
print(f"F1 Score:  {df['tool_f1'].mean():.2f}")

# ========== ERROR ANALYSIS ==========
print("\n=== Slowest Queries (Top 5) ===")
print(df.sort_values("time_taken_sec", ascending=False)[["query", "time_taken_sec"]].head(5))

print("\n=== Lowest Semantic Relevance (Top 5 FAILs) ===")
print(df[df["status"] == "FAIL"].sort_values("semantic_relevance").head(5)[["query", "semantic_relevance", "final_response"]])

# ========== THRESHOLD-BASED QUALITY ==========
threshold = 0.7
high_quality_ratio = (df["semantic_relevance"] > threshold).mean()
print(f"\n% of responses with semantic relevance > {threshold}: {high_quality_ratio * 100:.2f}%")

# Optional: Save enhanced data
df.to_csv("enhanced_test_results_with_metrics_ollama_gemma_enhanced.csv", index=False)
