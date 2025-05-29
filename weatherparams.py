import pandas as pd

# Load the CSV
df = pd.read_csv("weather_wiki_results_with_relevance_ibm.csv")

# Normalize tool columns
df["expected_tool"] = df["expected_tool"].fillna("none")
df["actual_tool"] = df["actual_tool"].fillna("none")

# ========== BASIC METRICS ==========
avg_time = df["time_taken_sec"].mean()
avg_semantic_relevance = df["semantic_relevance"].mean()

pass_count = (df["status"] == "PASS").sum()
fail_count = (df["status"] == "FAIL").sum()
# pass_fail_ratio removed since it depends on tool correctness

print("\n=== Basic Metrics ===")
print(f"Average Time Taken (sec): {avg_time:.2f}")
print(f"Average Semantic Relevance (embedding-based): {avg_semantic_relevance:.2f}")
print(f"Pass Count: {pass_count}, Fail Count: {fail_count}")

# ========== TOOL-WISE METRICS ==========
print("\n=== Per Tool Breakdown (Pass Rate) ===")
print(df.groupby("expected_tool")["status"].value_counts(normalize=True).unstack(fill_value=0))

print("\n=== Avg Time per Tool ===")
print(df.groupby("expected_tool")["time_taken_sec"].mean())

print("\n=== Avg Relevance per Tool ===")
print(df.groupby("expected_tool")[["semantic_relevance"]].mean())

# ========== ERROR ANALYSIS ==========
print("\n=== Slowest Queries (Top 5) ===")
print(df.sort_values("time_taken_sec", ascending=False)[["query", "time_taken_sec"]].head(5))

print("\n=== Lowest Semantic Relevance (Top 5 FAILs) ===")
print(df[df["status"] == "FAIL"].sort_values("semantic_relevance").head(5)[["query", "semantic_relevance", "final_response"]])

# ========== THRESHOLD-BASED QUALITY ==========
threshold = 0.7
high_quality_ratio = (df["semantic_relevance"] > threshold).mean()
print(f"\n% of responses with semantic relevance > {threshold}: {high_quality_ratio * 100:.2f}%")

# Optional: Save enhanced data if you want
df.to_csv("enhanced_test_results_no_tool_ratio.csv", index=False)
