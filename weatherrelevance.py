import pandas as pd
from sentence_transformers import SentenceTransformer, util

df = pd.read_csv("test_results_mistral.csv")
model = SentenceTransformer("all-MiniLM-L6-v2")

def get_similarity(q, r):
    return util.cos_sim(model.encode(q, convert_to_tensor=True),
                        model.encode(r, convert_to_tensor=True)).item()

df["semantic_relevance"] = df.apply(lambda row: get_similarity(row["query"], row["final_response"]), axis=1)
df.to_csv("test_results_mistral_enhanced.csv", index=False)
