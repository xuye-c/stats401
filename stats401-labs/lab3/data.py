import requests
import time
import pandas as pd

url = "https://api.openalex.org/works"

papers = []
#抓10页
for page in range(1, 11):
    #每页100条数据
    params = {"per-page": 100,"page": page}
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Request failed: {e}")
        continue
    #数据抓完休息一秒
    time.sleep(1)
    #处理数据，保存到papers列表中
    data = response.json()
    for paper in data["results"]:
        row = {
            "id": paper["id"],
            "title": paper["title"],
            "publication_year": paper["publication_year"],
            "type": paper["type"],
            "cited_by_count": paper["cited_by_count"],
            "is_oa": paper["open_access"]["is_oa"]
        }
        papers.append(row)
print(len(papers))
#输出csv
df = pd.DataFrame(papers)
df.to_csv("stats401-labs/data/lab3_data.csv",index=False)
