"""Build data/critique_water.json from data/critique.csv.

The page draws this JSON. Rows that would double-count a parent, mix a
yearly flow into a stock, or sit inside a body already counted are left out.
"""

import csv
import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "critique.csv"
JSON_PATH = ROOT / "data" / "critique_water.json"

SALT = [
    "Oceans, seas, and bays",
    "Groundwater, saline",
    "Lakes, saline",
]
FRESH = [
    ("Ice caps, glaciers, and permanent snow", "Ice caps, glaciers, and permanent snow"),
    ("Groundwater, fresh", "Groundwater, fresh"),
    ("Ground ice and permafrost", "Ground ice and permafrost"),
    ("Lakes, fresh water", "Lakes, fresh"),
    ("Soil moisture", "Soil moisture"),
    ("Atmosphere", "Atmosphere"),
    ("Swamps", "Swamps"),
    ("Rivers", "Rivers"),
]
PRODUCTS = [
    ("Soft drinks", "Soft drinks"),
    ("Milk, 1L bottles", "Milk"),
    ("Beer, 1L bottles", "Beer"),
    ("Bath tubs", "Bath tubs"),
    ("Inside Loaves of bread", "Bread"),
    ("Bananas", "Bananas"),
]
MIN_PRODUCT_KM3 = Decimal("0.01")


def parse_km3(text):
    text = text.strip().replace(",", "")
    if not text or text in {"-", "NA"}:
        return None
    try:
        return Decimal(text)
    except Exception:
        return None


def load_rows(path):
    rows = []
    with path.open(newline="") as handle:
        for raw in csv.reader(handle):
            cells = list(raw) + ["", "", ""]
            km3 = parse_km3(cells[2])
            if km3 is None:
                continue
            rows.append((cells[0].strip(), cells[1].strip(), km3))
    return rows


def value_of(rows, name):
    matches = [km3 for section, label, km3 in rows if name in {section, label}]
    if len(matches) != 1:
        raise SystemExit(f"{name!r} matched {len(matches)} rows")
    return matches[0]


def as_json_number(km3):
    if km3 == km3.to_integral_value():
        return int(km3)
    return float(km3)


def leaf(name, group, km3):
    return {"name": name, "group": group, "km3": as_json_number(km3)}


def build(rows):
    # Combined fresh+saline rows repeat the split rows, so they are not read.
    salt = [leaf(name, "salt", value_of(rows, name)) for name in SALT]
    fresh = [leaf(label, "fresh", value_of(rows, name)) for name, label in FRESH]

    biological_total = value_of(rows, "Biological Water")
    trees = value_of(rows, "Trees")
    if trees <= biological_total:
        raise SystemExit("expected trees to sit outside the 1,120 km³ organism total")
    rainfall = value_of(rows, "Falling on land as rain / snow / hail, per year")
    if rainfall != Decimal("110000") or biological_total != Decimal("1120"):
        raise SystemExit("page notes for rainfall and the biological total need updating")

    humans = [
        leaf("Male bodies", "human", value_of(rows, "Human bodies, males")),
        leaf("Female bodies", "human", value_of(rows, "Human bodies, females")),
    ]
    # Blood, brains, and tears sit inside the body rows.
    # The unnamed remainder of the 1,120 km³ total is omitted; the page says so.

    products = []
    for name, label in PRODUCTS:
        km3 = value_of(rows, name)
        if "per year" in name.lower() or km3 < MIN_PRODUCT_KM3:
            continue
        products.append(leaf(label, "product", km3))

    return {
        "global": {
            "name": "Global water",
            "children": [
                {"name": "Salt water", "group": "salt", "children": salt},
                {"name": "Fresh water", "group": "fresh", "children": fresh},
            ],
        },
        "biological": {
            "name": "Biological water",
            "children": [
                leaf("Trees", "tree", trees),
                leaf("Insects", "insect", value_of(rows, "Insects")),
                {
                    "name": "Other",
                    "group": "other",
                    "other": True,
                    "children": [
                        {"name": "Humans", "group": "human", "children": humans},
                        leaf("Pigs", "animal", value_of(rows, "Pigs")),
                        leaf("Horses", "animal", value_of(rows, "Horses")),
                        leaf("Blue whales", "animal", value_of(rows, "Blue Whale")),
                    ],
                },
            ],
        },
        "use": [
            leaf("Used by humans", "flow", value_of(rows, "Used by humans per year")) | {"note": "per year"},
            leaf("Groundwater extracted", "flow", value_of(rows, "Groundwater extracted, per year, 2000"))
            | {"note": "per year, 2000"},
        ],
        "products": products,
    }


def main():
    payload = build(load_rows(CSV_PATH))
    JSON_PATH.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
