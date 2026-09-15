import json

import pandas as pd


def build_hierarchy(dataframe, levels, value_column, status_column):
    if len(levels) == 1:
        return [
            {
                "name": row[levels[0]],
                "gdp": float(row[value_column]),
                "status": row[status_column],
            }
            for _, row in dataframe.iterrows()
        ]

    current_level = levels[0]
    children = []

    for value, group in dataframe.groupby(current_level, sort=True):
        children.append(
            {
                "name": value,
                "children": build_hierarchy(
                    group,
                    levels[1:],
                    value_column,
                    status_column,
                ),
            }
        )

    return children


def main():
    df = pd.read_csv("../data/lab6_assignment_gdp.csv")

    hierarchy = {
        "name": "World",
        "children": build_hierarchy(
            df,
            ["continent", "area", "country"],
            "gdp_billion_usd",
            "gdp_status",
        ),
    }

    with open(
        "../data/lab6_assignment_gdp.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(hierarchy, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
