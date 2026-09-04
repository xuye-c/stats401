import json
import pandas as pd
import re
from transformers import pipeline
import os
file_path = "stats401-labs/data/lab4_raw_tweets.jsonl"

#utils
def prepare_for_roberta(text):
    text = str(text)
    # Replace mentions
    text = re.sub(r"@\w+", "@user", text)
    # Replace URLs
    text = re.sub(
        r"https?://\S+|www\.\S+",
        "http",
        text
    )
    return text.strip()
def scores_to_dict(scores):
    return {
        item["label"].lower(): item["score"]
        for item in scores
    }
def predicted_label(scores):
    return max(
        scores,
        key=scores.get
    ).capitalize()

# Read JSONL
with open(file_path, "r", encoding="utf-8") as f:
    records = [json.loads(line) for line in f]

df = pd.DataFrame(records)
#print(df.head())
#print(df.columns)
#print(df.shape)
# Flatten public_metrics
metrics = pd.json_normalize(df["public_metrics"])
df = pd.concat(
    [df.drop(columns=["public_metrics"]),metrics],
    axis=1
)
#print(df.head())
#print(df.columns)
#print(df.shape)

#print("\nData Info")
#print(df.info())
#print("\nMissing Values")
#print(df.isna().sum())
#print("\nDuplicate Rows")
#print("Duplicate rows:", df.duplicated().sum())
#print("\nDuplicate Tweet IDs")
#print("Duplicate IDs:", df["id"].duplicated().sum())

df["created_at"] = pd.to_datetime(
    df["created_at"],
    errors="coerce",
    utc=True
)
#print("\nDate Check")
#print(df["created_at"].dtype)
#print("Invalid dates:", df["created_at"].isna().sum())

metric_cols = [
    "retweet_count",
    "reply_count",
    "like_count",
    "quote_count",
    "bookmark_count",
    "impression_count"
]
#print("\nNegative Values")
#for col in metric_cols:
   #print(col,(df[col] < 0).sum())
    #pass
#print("\n--- Sentiment Text ---")

df["sentiment_text"] = (
    df["text"]
    .fillna("")
    .apply(prepare_for_roberta)
)

#for i in range(5):
    #print("Original:", df["text"].iloc[i])
    #print("Prepared:", df["sentiment_text"].iloc[i])
    #print()
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "60"
os.environ["HF_HUB_ETAG_TIMEOUT"] = "60"
sentiment_model = pipeline(
    "sentiment-analysis",
    model="model",
    top_k=None
)

#test_tweet = "I absolutely love this new update!"
#result = sentiment_model(test_tweet)
#print("\nTest Sentiment")
#print(result)

print("\nRunning sentiment analysis on all tweets...")
results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)
print("Number of results:", len(results))

score_dicts = [scores_to_dict(scores)for scores in results]
df["sentiment_negative"] = [scores.get("negative", 0)for scores in score_dicts]
df["sentiment_neutral"] = [scores.get("neutral", 0)for scores in score_dicts]
df["sentiment_positive"] = [scores.get("positive", 0)for scores in score_dicts]

df["sentiment"] = [predicted_label(scores)for scores in score_dicts]

#print(df[["text","sentiment_negative","sentiment_neutral","sentiment_positive","sentiment"]].head())
#print("\nSentiment counts:")
#print(df["sentiment"].value_counts())
df["sentiment_score"] = (df["sentiment_positive"] - df["sentiment_negative"])
#print(df[["text","sentiment","sentiment_score"]].head())
# Extract time-related features
df["date"] = df["created_at"].dt.date
df["hour"] = df["created_at"].dt.hour
df["weekday"] = df["created_at"].dt.day_name()
vis_df = df[[
    "id",
    "created_at",
    "date",
    "hour",
    "weekday",
    "text",
    "author_id",
    "retweet_count",
    "reply_count",
    "like_count",
    "quote_count",
    "bookmark_count",
    "impression_count",
    "sentiment_score",
    "sentiment"
]].copy()
print("\nVisualization-ready data:")
print(vis_df.head())

print("\nData info:")
print(vis_df.info())

print("\nMissing values:")
print(vis_df.isna().sum())

print("\nSentiment distribution:")
print(vis_df["sentiment"].value_counts())
df.to_csv("stats401-labs/data/lab4_processed_tweets.csv",index=False)
print("Saved processed data.")