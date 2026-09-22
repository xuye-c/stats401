const topicColors = [
    "#6ea8ff",
    "#e0896c",
    "#7dceae",
    "#c49be8",
    "#e6c35c",
    "#8fb4c9",
    "#d4b8c8",
    "#9da9ff",
    "#b8d4a8"
];

const tooltip = d3.select("#tooltip");

Promise.all([
    d3.csv("../data/lab8_embedding_map.csv", d => ({
        ...d,
        x: +d.x,
        y: +d.y,
        word_count: +d.word_count,
        cluster: +d.cluster,
        page: +d.page
    })),
    d3.json("../data/lab8_neighbors.json"),
    d3.json("../data/lab8_overview.json"),
    d3.csv("../data/lab8_topic_section_matrix.csv", d => ({
        ...d,
        count: +d.count,
        proportion: +d.proportion,
        chapter_total: +d.chapter_total
    }))
]).then(([passages, neighbors, overview, matrix]) => {
    renderStats(overview);
    drawChapterBars(overview);
    drawTfidfBars(overview);
    const state = createExplorer(passages, neighbors, overview);
    drawMatrix(matrix, overview, state);
});

function renderStats(overview) {
    const items = [
        ["Raw passages", overview.n_raw],
        ["After cleaning", overview.n_clean],
        ["Mean words", overview.mean_words.toFixed(0)],
        ["Formal chapters", overview.n_chapters],
        ["Heading sections", overview.n_sections],
        ["Topics", overview.clustering.k]
    ];
    d3.select("#corpus-stats")
        .selectAll("li")
        .data(items)
        .join("li")
        .html(d => `<strong>${d[1]}</strong> ${d[0]}`);
}

function drawChapterBars(overview) {
    const rows = Object.entries(overview.chapter_counts)
        .map(([chapter, count]) => ({ chapter, count }))
        .sort((a, b) => partNum(a.chapter) - partNum(b.chapter));

    const width = 640;
    const height = 280;
    const margin = { top: 12, right: 16, bottom: 20, left: 168 };

    const svg = d3.select("#chapter-bars")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const y = d3.scaleBand()
        .domain(rows.map(d => shortChapter(d.chapter)))
        .range([margin.top, height - margin.bottom])
        .padding(0.18);
    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.count)])
        .nice()
        .range([margin.left, width - margin.right]);

    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .attr("class", "tick")
        .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0));
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .attr("class", "tick")
        .call(d3.axisLeft(y).tickSizeOuter(0));

    svg.selectAll("rect")
        .data(rows)
        .join("rect")
        .attr("x", margin.left)
        .attr("y", d => y(shortChapter(d.chapter)))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.count) - margin.left)
        .attr("fill", "#7c8cff")
        .attr("rx", 3);
}

function drawTfidfBars(overview) {
    const rows = overview.top_tfidf_terms.slice(0, 12);
    const width = 420;
    const height = 280;
    const margin = { top: 12, right: 16, bottom: 20, left: 92 };

    const svg = d3.select("#tfidf-bars")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const y = d3.scaleBand()
        .domain(rows.map(d => d.term))
        .range([margin.top, height - margin.bottom])
        .padding(0.18);
    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.score)])
        .nice()
        .range([margin.left, width - margin.right]);

    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .attr("class", "tick")
        .call(d3.axisBottom(x).ticks(4).tickSizeOuter(0));
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .attr("class", "tick")
        .call(d3.axisLeft(y).tickSizeOuter(0));

    svg.selectAll("rect")
        .data(rows)
        .join("rect")
        .attr("x", margin.left)
        .attr("y", d => y(d.term))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.score) - margin.left)
        .attr("fill", "#7dceae")
        .attr("rx", 3);
}

function partNum(name) {
    const match = String(name).match(/Part\s+(\d+)/);
    return match ? +match[1] : 99;
}

function shortChapter(name) {
    return name.replace(/^Part \d+:\s*/, "");
}

function createExplorer(passages, neighbors, overview) {
    const width = 860;
    const height = 620;
    const margin = { top: 24, right: 20, bottom: 24, left: 20 };

    const topics = Object.values(overview.cluster_names);
    const chapters = [...new Set(passages.map(d => d.chapter))]
        .sort((a, b) => partNum(a) - partNum(b));
    const color = d3.scaleOrdinal().domain(topics).range(topicColors);
    const size = d3.scaleSqrt()
        .domain(d3.extent(passages, d => d.word_count))
        .range([3.2, 10]);

    const x = d3.scaleLinear()
        .domain(d3.extent(passages, d => d.x))
        .nice()
        .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear()
        .domain(d3.extent(passages, d => d.y))
        .nice()
        .range([height - margin.bottom, margin.top]);

    const chapterSelect = d3.select("#chapter-filter");
    chapterSelect.selectAll("option.chapter")
        .data(chapters)
        .join("option")
        .attr("class", "chapter")
        .attr("value", d => d)
        .text(d => shortChapter(d));

    const topicSelect = d3.select("#topic-filter");
    topicSelect.selectAll("option.topic")
        .data(topics)
        .join("option")
        .attr("class", "topic")
        .attr("value", d => d)
        .text(d => d);

    const legend = d3.select("#map-legend");
    legend.selectAll("div")
        .data(topics)
        .join("div")
        .attr("class", "legend-item")
        .html(d => `<span class="legend-swatch" style="background:${color(d)}"></span>${d}`);

    const svg = d3.select("#map")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent");

    const g = svg.append("g");

    const zoom = d3.zoom()
        .scaleExtent([0.7, 12])
        .on("zoom", event => g.attr("transform", event.transform));
    svg.call(zoom);

    const points = g.selectAll("circle")
        .data(passages)
        .join("circle")
        .attr("class", "passage")
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", d => size(d.word_count))
        .attr("fill", d => color(d.cluster_name))
        .attr("stroke", "rgba(8,11,18,0.45)");

    const state = {
        query: "",
        chapter: "all",
        topic: "all",
        selected: null,
        neighborIds: new Set(),
        matrixKey: null,
        color,
        refresh() {
            applyAppearance();
            if (this.onMatrix) {
                this.onMatrix();
            }
        }
    };

    function matchesFilters(d) {
        const q = state.query;
        const textOk = q === "" || d.text.toLowerCase().includes(q)
            || d.section.toLowerCase().includes(q)
            || d.cluster_name.toLowerCase().includes(q);
        const chapterOk = state.chapter === "all" || d.chapter === state.chapter;
        const topicOk = state.topic === "all" || d.cluster_name === state.topic;
        const matrixOk = !state.matrixKey
            || (d.chapter === state.matrixKey.chapter && d.cluster_name === state.matrixKey.topic);
        return textOk && chapterOk && topicOk && matrixOk;
    }

    function applyAppearance() {
        points
            .classed("is-selected", d => state.selected && d.passage_id === state.selected)
            .classed("is-neighbor", d => state.neighborIds.has(d.passage_id))
            .attr("opacity", d => {
                if (!matchesFilters(d)) {
                    return 0.06;
                }
                if (state.selected && d.passage_id !== state.selected && !state.neighborIds.has(d.passage_id)) {
                    return 0.22;
                }
                return 1;
            });
    }

    function showDetail(d) {
        const neigh = (neighbors[d.passage_id] || []).map(n => {
            const row = passages.find(p => p.passage_id === n.passage_id);
            return { ...n, ...row };
        });
        state.selected = d.passage_id;
        state.neighborIds = new Set(neigh.map(n => n.passage_id));
        state.matrixKey = { chapter: d.chapter, topic: d.cluster_name };

        const panel = d3.select("#detail-panel");
        panel.html(`
            <h3>${d.section}</h3>
            <p class="meta">
                ${d.chapter}<br>
                ${d.subsection ? `${d.subsection}<br>` : ""}
                Page ${d.page} · ${d.word_count} words<br>
                Topic: <strong>${d.cluster_name}</strong>
            </p>
            <p class="detail-passage">${d.text}</p>
            <h3>Nearest semantic neighbors</h3>
        `);
        panel.selectAll("button.neighbor-btn")
            .data(neigh)
            .join("button")
            .attr("class", "neighbor-btn")
            .attr("type", "button")
            .html(n => `<strong>${n.section}</strong> · ${n.score}<br>${shortChapter(n.chapter)}`)
            .on("click", (event, n) => {
                event.stopPropagation();
                const target = passages.find(p => p.passage_id === n.passage_id);
                if (target) {
                    showDetail(target);
                    state.refresh();
                }
            });
        state.refresh();
    }

    points
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(`
                <strong>${d.section}</strong><br>
                ${d.cluster_name}<br>
                ${shortChapter(d.chapter)} · p.${d.page}
            `);
        })
        .on("mousemove", event => {
            tooltip
                .style("left", `${event.clientX + 12}px`)
                .style("top", `${event.clientY + 12}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (event, d) => {
            event.stopPropagation();
            showDetail(d);
        });

    d3.select("#search").on("input", function () {
        state.query = this.value.toLowerCase().trim();
        state.refresh();
    });
    chapterSelect.on("change", function () {
        state.chapter = this.value;
        state.refresh();
    });
    topicSelect.on("change", function () {
        state.topic = this.value;
        state.refresh();
    });
    d3.select("#clear-selection").on("click", () => {
        state.selected = null;
        state.neighborIds = new Set();
        state.matrixKey = null;
        state.query = "";
        state.chapter = "all";
        state.topic = "all";
        d3.select("#search").property("value", "");
        chapterSelect.property("value", "all");
        topicSelect.property("value", "all");
        d3.select("#detail-panel").html(`
            <p class="detail-placeholder">
                Click a passage in the map to read it and see
                semantically similar passages from other sections.
            </p>
        `);
        state.refresh();
    });

    state.showDetail = showDetail;
    applyAppearance();
    return state;
}

function drawMatrix(matrix, overview, state) {
    const topics = Object.values(overview.cluster_names);
    const chapters = [...new Set(matrix.map(d => d.chapter))]
        .sort((a, b) => partNum(a) - partNum(b));

    const width = 1180;
    const height = 420;
    const margin = { top: 118, right: 24, bottom: 28, left: 210 };

    const svg = d3.select("#matrix")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3.scaleBand()
        .domain(topics)
        .range([margin.left, width - margin.right])
        .padding(0.12);
    const y = d3.scaleBand()
        .domain(chapters)
        .range([margin.top, height - margin.bottom])
        .padding(0.12);
    const fill = d3.scaleSequential(d3.interpolatePuBu)
        .domain([0, d3.max(matrix, d => d.count)]);

    svg.append("g")
        .attr("class", "tick")
        .attr("transform", `translate(0,${margin.top})`)
        .call(d3.axisTop(x).tickSize(0))
        .selectAll("text")
        .attr("text-anchor", "start")
        .attr("transform", "rotate(-38)")
        .attr("dx", "0.4em")
        .attr("dy", "0.2em");

    svg.append("g")
        .attr("class", "tick")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(shortChapter).tickSize(0));

    const cells = svg.selectAll("rect.matrix-cell")
        .data(matrix)
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("x", d => x(d.cluster_name))
        .attr("y", d => y(d.chapter))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 3)
        .attr("fill", d => fill(d.count));

    cells
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(`
                <strong>${shortChapter(d.chapter)}</strong><br>
                Topic: ${d.cluster_name}<br>
                Passages: ${d.count}
                (${(d.proportion * 100).toFixed(1)}% of chapter)
            `);
        })
        .on("mousemove", event => {
            tooltip
                .style("left", `${event.clientX + 12}px`)
                .style("top", `${event.clientY + 12}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (event, d) => {
            event.stopPropagation();
            if (state.matrixKey
                && state.matrixKey.chapter === d.chapter
                && state.matrixKey.topic === d.cluster_name
                && !state.selected) {
                state.matrixKey = null;
            } else {
                state.selected = null;
                state.neighborIds = new Set();
                state.matrixKey = { chapter: d.chapter, topic: d.cluster_name };
                d3.select("#detail-panel").html(`
                    <h3>${shortChapter(d.chapter)}</h3>
                    <p class="meta">Topic: <strong>${d.cluster_name}</strong></p>
                    <p>${d.count} passages
                    (${(d.proportion * 100).toFixed(1)}% of this chapter).
                    Matching points are highlighted on the map.</p>
                `);
            }
            state.refresh();
        });

    state.onMatrix = () => {
        cells.classed("is-active", d =>
            state.matrixKey
            && d.chapter === state.matrixKey.chapter
            && d.cluster_name === state.matrixKey.topic
        );
    };
    state.onMatrix();
}
