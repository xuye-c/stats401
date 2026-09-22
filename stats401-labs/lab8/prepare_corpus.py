#!/usr/bin/env python3
"""Prepare Lab 8 corpus, embeddings, UMAP, clusters, and visualization CSVs."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import umap
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoModel, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SOURCE = DATA / "bulletin_2021_22.txt"
N_CLUSTERS = 9
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

PARTS = {
    1: "Part 1: General Information",
    2: "Part 2: Liberal Arts Education",
    3: "Part 3: The Curriculum",
    4: "Part 4: Admission and Financial Aid",
    5: "Part 5: Financial Information",
    6: "Part 6: Academic Procedures",
    7: "Part 7: Academic Advising and Support",
    8: "Part 8: Career, Study Away, Research",
    9: "Part 9: Student Affairs and Campus Life",
    10: "Part 10: Majors and Courses",
    11: "Part 11: Academic Calendar",
    12: "Part 12: Useful Contacts",
}

HEADER_RE = re.compile(
    r"^(bulletin of|duke kunshan university|undergraduate instruction|"
    r"table of contents|july 2021)$",
    re.I,
)
PART_RE = re.compile(r"^#{0,6}\s*part\s+(\d+)\s*:\s*(.+)$", re.I)
TOC_RE = re.compile(r"\.{2,}\s*\d+\s*$")
PAGE_RE = re.compile(r"^\d{1,3}$")
TABLE_RE = re.compile(r"^\s*\|")


def is_heading(line: str) -> bool:
    if len(line) < 4 or len(line) > 90:
        return False
    if line.endswith(".") and not line.endswith("U.S."):
        return False
    if line.startswith(("•", "-", "*", "a.", "b.", "c.", "d.", "e.", "f.")):
        return False
    if TOC_RE.search(line) or TABLE_RE.match(line):
        return False
    if re.search(r"\d{4}-\d{2}-\d{2}", line):
        return False
    letters = sum(ch.isalpha() for ch in line)
    if letters < 8:
        return False
    words = line.split()
    cap = sum(w[0].isupper() for w in words if w[:1].isalpha())
    return cap >= max(1, int(0.5 * len(words)))


def extract_passages(raw: str) -> tuple[list[dict], int]:
    lines = [ln.replace("\xa0", " ").rstrip() for ln in raw.splitlines()]
    start = 0
    for i, ln in enumerate(lines):
        if PART_RE.match(ln.strip()) and "General Information" in ln:
            start = i
            break

    raw_blocks: list[str] = []
    chapter = PARTS[1]
    section = "Welcome"
    subsection = ""
    page = 10
    buf: list[str] = []
    in_courses = False

    def flush() -> None:
        text = re.sub(r"\s+", " ", " ".join(buf)).strip()
        buf.clear()
        if not text:
            return
        raw_blocks.append(text)

    for ln in lines[start:]:
        s = ln.strip()
        if not s:
            flush()
            continue
        if HEADER_RE.match(s) or s.lower() in {"4", "5", "6", "7", "8", "9"}:
            if PAGE_RE.match(s):
                page = int(s)
            continue
        if PAGE_RE.match(s):
            val = int(s)
            if 10 <= val <= 420:
                page = val
                continue
        if TABLE_RE.match(s) or s.startswith("| ---"):
            continue
        if TOC_RE.search(s) and len(s) < 140:
            continue

        part_m = PART_RE.match(s)
        if part_m:
            flush()
            n = int(part_m.group(1))
            chapter = PARTS.get(n, f"Part {n}: {part_m.group(2).strip()}")
            section = part_m.group(2).strip()
            subsection = ""
            in_courses = False
            continue

        if s.lower().startswith("course descriptions"):
            flush()
            section = "Course Descriptions"
            subsection = ""
            in_courses = True
            continue

        if s.startswith("Courses with Course Subject:"):
            flush()
            section = "Course Descriptions"
            subsection = s.replace("Courses with Course Subject:", "").strip()
            in_courses = True
            continue

        if is_heading(s) and not in_courses:
            flush()
            if chapter.startswith("Part 10") and "track" in s.lower():
                subsection = s
            elif chapter.startswith("Part 10"):
                section = "Majors"
                subsection = s
            else:
                section = s
                subsection = ""
            continue

        if is_heading(s) and in_courses and re.match(r"^[A-Z]{2,10}\s+\d{3}", s):
            flush()
            subsection = s
            continue

        buf.append(s)

    flush()
    n_raw = len(raw_blocks)

    passages = []
    seen = set()
    pid = 1
    for text in raw_blocks:
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 80:
            continue
        words = text.split()
        if not (28 <= len(words) <= 420):
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        # recover metadata by re-walking is hard here; store from last state
        passages.append({"text": text, "_order": pid})
        pid += 1

    return passages, n_raw


def extract_with_meta(raw: str) -> tuple[pd.DataFrame, int]:
    lines = [ln.replace("\xa0", " ").rstrip() for ln in raw.splitlines()]
    start = 0
    for i, ln in enumerate(lines):
        if PART_RE.match(ln.strip()) and "General Information" in ln:
            start = i
            break

    rows = []
    chapter = PARTS[1]
    section = "Welcome"
    subsection = ""
    page = 10
    buf: list[str] = []
    in_courses = False
    n_raw = 0

    def emit() -> None:
        nonlocal n_raw
        text = re.sub(r"\s+", " ", " ".join(buf)).strip()
        buf.clear()
        if not text:
            return
        n_raw += 1
        words = text.split()
        if len(text) < 55 or not (18 <= len(words) <= 500):
            return
        rows.append(
            {
                "chapter": chapter,
                "section": section,
                "subsection": subsection,
                "page": page,
                "text": text,
                "word_count": len(words),
            }
        )

    for ln in lines[start:]:
        s = ln.strip()
        if not s:
            emit()
            continue
        if HEADER_RE.match(s):
            continue
        if PAGE_RE.match(s):
            val = int(s)
            if 10 <= val <= 420:
                page = val
            continue
        if TABLE_RE.match(s) or s.startswith("| ---"):
            continue
        if TOC_RE.search(s) and len(s) < 140:
            continue

        part_m = PART_RE.match(s)
        if part_m:
            emit()
            n = int(part_m.group(1))
            chapter = PARTS.get(n, f"Part {n}: {part_m.group(2).strip()}")
            section = re.sub(r"\s+\.+\s*\d+$", "", part_m.group(2)).strip()
            subsection = ""
            in_courses = False
            continue

        if s.lower().startswith("course descriptions"):
            emit()
            section = "Course Descriptions"
            subsection = ""
            in_courses = True
            continue

        if s.startswith("Courses with Course Subject:"):
            emit()
            section = "Course Descriptions"
            subsection = re.sub(r"\.{2,}.*$", "", s.replace("Courses with Course Subject:", "")).strip()
            in_courses = True
            continue

        if is_heading(s) and not in_courses:
            emit()
            if chapter.startswith("Part 10"):
                section = "Majors"
                subsection = s
            else:
                section = s
                subsection = ""
            continue

        buf.append(s)

    emit()
    df = pd.DataFrame(rows)
    df = df.drop_duplicates(subset=["text"]).reset_index(drop=True)
    df.insert(0, "passage_id", [f"p{i:04d}" for i in range(1, len(df) + 1)])
    df["section_group"] = df["section"].where(
        df["section"].isin(["Course Descriptions", "Majors"]),
        df["chapter"],
    )
    return df, n_raw


def mean_pool(hidden, mask):
    mask = mask.unsqueeze(-1).expand(hidden.size()).float()
    summed = torch.sum(hidden * mask, dim=1)
    counts = torch.clamp(mask.sum(dim=1), min=1e-9)
    return summed / counts


def encode_texts(texts: list[str]) -> np.ndarray:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, local_files_only=True)
    model = AutoModel.from_pretrained(MODEL_NAME, local_files_only=True)
    model.eval()
    batches = []
    bs = 24
    with torch.no_grad():
        for i in range(0, len(texts), bs):
            chunk = texts[i : i + bs]
            enc = tokenizer(
                chunk,
                padding=True,
                truncation=True,
                max_length=256,
                return_tensors="pt",
            )
            out = model(**enc)
            emb = mean_pool(out.last_hidden_state, enc["attention_mask"])
            emb = F.normalize(emb, p=2, dim=1)
            batches.append(emb.cpu().numpy())
            if i % 240 == 0:
                print(f"  encoded {min(i + bs, len(texts))}/{len(texts)}")
    return np.vstack(batches)


def label_clusters(df: pd.DataFrame) -> dict[int, str]:
    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=4000,
        ngram_range=(1, 2),
        min_df=2,
    )
    x = vectorizer.fit_transform(df["text"])
    terms = np.array(vectorizer.get_feature_names_out())
    labels = {}
    print("\n=== Cluster inspection ===")
    for c in sorted(df["cluster"].unique()):
        idx = np.where(df["cluster"].to_numpy() == c)[0]
        centroid = np.asarray(x[idx].mean(axis=0)).ravel()
        top = terms[centroid.argsort()[::-1][:12]]
        sample = df.loc[df["cluster"] == c, "text"].head(4).tolist()
        print(f"\nCLUSTER {c} n={len(idx)}")
        print("TF-IDF:", ", ".join(top))
        for t in sample:
            print("-", t[:220].replace("\n", " "))
        labels[int(c)] = ", ".join(top[:4])
    return labels, vectorizer, x, terms


CLUSTER_NAMES = {
    0: "Social Science and Global Majors",
    1: "Course Load and Academic Standing",
    2: "Admissions, Tuition, and Costs",
    3: "Curriculum and Language Requirements",
    4: "Major Electives",
    5: "STEM Majors and Quantitative Courses",
    6: "Mission, Community, and Campus Life",
    7: "Chinese Language, Culture, and Campus Life",
    8: "Dual Degrees, Transfer, and Graduation Credit",
}


def assign_names(df: pd.DataFrame, tfidf_labels: dict[int, str]) -> dict[int, str]:
    return {int(c): CLUSTER_NAMES.get(int(c), tfidf_labels[int(c)]) for c in df["cluster"].unique()}


def main() -> None:
    raw = SOURCE.read_text(encoding="utf-8")
    df, n_raw = extract_with_meta(raw)
    print(f"raw blocks={n_raw} cleaned passages={len(df)}")
    print(df["chapter"].value_counts())
    print("mean words", df["word_count"].mean())

    print("Loading embedding model", MODEL_NAME)
    embeddings = encode_texts(df["text"].tolist())
    print("embeddings", embeddings.shape)

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=401,
    )
    coords = reducer.fit_transform(embeddings)
    df["x"] = coords[:, 0]
    df["y"] = coords[:, 1]

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=401, n_init="auto")
    df["cluster"] = kmeans.fit_predict(embeddings)

    tfidf_labels, vectorizer, x, terms = label_clusters(df)
    names = assign_names(df, tfidf_labels)
    df["cluster_name"] = df["cluster"].map(names)
    print("\nAssigned names:", names)

    sim = cosine_similarity(embeddings)
    neighbors = {}
    for i, pid in enumerate(df["passage_id"]):
        scores = sim[i].copy()
        scores[i] = -1
        top = np.argpartition(scores, -5)[-5:]
        top = top[np.argsort(scores[top])[::-1]]
        neighbors[pid] = [
            {
                "passage_id": str(df.iloc[j]["passage_id"]),
                "score": round(float(scores[j]), 3),
                "section": df.iloc[j]["section"],
                "chapter": df.iloc[j]["chapter"],
            }
            for j in top
        ]

    overview = {
        "title": "Bulletin of Duke Kunshan University Undergraduate Instruction, 2021–2022",
        "year": "2021-2022",
        "accessed": "2026-09-23",
        "source": "https://dku-web-admissions.s3.cn-north-1.amazonaws.com.cn/dkumain/files/V2021-22_DKU_UG_Bulletin.pdf",
        "n_raw": int(n_raw),
        "n_clean": int(len(df)),
        "n_chapters": int(df["chapter"].nunique()),
        "n_sections": int(df["section"].nunique()),
        "mean_words": float(df["word_count"].mean()),
        "median_words": float(df["word_count"].median()),
        "embedding_model": MODEL_NAME,
        "umap": {"n_neighbors": 15, "min_dist": 0.15, "metric": "cosine", "random_state": 401},
        "clustering": {"method": "KMeans", "k": N_CLUSTERS, "random_state": 401},
        "cluster_names": names,
        "chapter_counts": df["chapter"].value_counts().to_dict(),
        "section_counts": df["section"].value_counts().head(20).to_dict(),
        "topic_counts": df["cluster_name"].value_counts().to_dict(),
        "mean_words_by_chapter": df.groupby("chapter")["word_count"].mean().round(1).to_dict(),
    }

    vectorizer2 = TfidfVectorizer(stop_words="english", max_features=30, ngram_range=(1, 2), min_df=5)
    vectorizer2.fit(df["text"])
    overview["top_terms"] = list(vectorizer2.get_feature_names_out())

    # Better top terms: highest total tf-idf
    full = TfidfVectorizer(stop_words="english", max_features=2500, ngram_range=(1, 2), min_df=3)
    xm = full.fit_transform(df["text"])
    totals = np.asarray(xm.sum(axis=0)).ravel()
    feats = np.array(full.get_feature_names_out())
    overview["top_tfidf_terms"] = [
        {"term": str(t), "score": round(float(s), 2)}
        for t, s in zip(feats[totals.argsort()[::-1][:25]], sorted(totals, reverse=True)[:25])
    ]

    matrix = (
        df.groupby(["chapter", "cluster_name"])
        .size()
        .reset_index(name="count")
    )
    chapter_tot = df.groupby("chapter").size().rename("chapter_total")
    matrix = matrix.merge(chapter_tot, on="chapter")
    matrix["proportion"] = (matrix["count"] / matrix["chapter_total"]).round(4)

    keep = [
        "passage_id",
        "chapter",
        "section",
        "section_group",
        "subsection",
        "page",
        "text",
        "word_count",
        "cluster",
        "cluster_name",
        "x",
        "y",
    ]
    df[keep].to_csv(DATA / "lab8_embedding_map.csv", index=False)
    matrix.to_csv(DATA / "lab8_topic_section_matrix.csv", index=False)
    (DATA / "lab8_neighbors.json").write_text(json.dumps(neighbors), encoding="utf-8")
    (DATA / "lab8_overview.json").write_text(json.dumps(overview, indent=2), encoding="utf-8")
    print("Wrote visualization CSVs and JSON.")


if __name__ == "__main__":
    main()
