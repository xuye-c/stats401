const width = 1180;
const height = 720;
const margin = { top: 48, right: 36, bottom: 92, left: 36 };

const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%b %d, %Y");
const formatMoney = d3.format("$,.0f");

const sectorColors = {
    Manufacturing: "#6ea8ff",
    Logistics: "#e0896c",
    Retail: "#7dceae",
    Food: "#e6c35c",
    Technology: "#c49be8",
    Wholesale: "#8fb4c9",
    Materials: "#d4b8c8"
};

const typeColors = {
    goods: "#9ec5e8",
    shipping: "#b8d4a8",
    components: "#e0b0a0",
    materials: "#e6c35c",
    services: "#c4b0e8"
};

const regionX = {
    Asia: margin.left + (width - margin.left - margin.right) * 0.18,
    Europe: width / 2,
    "North America": width - margin.right - (width - margin.left - margin.right) * 0.18
};

const regionSymbol = {
    Asia: d3.symbolCircle,
    Europe: d3.symbolSquare,
    "North America": d3.symbolTriangle
};

const tooltip = d3.select("#tooltip");
const dateLabelFormat = d3.timeFormat("%Y-%m-%d");

function nodeId(end) {
    return typeof end === "object" ? end.id : end;
}

function linkKey(d) {
    return [nodeId(d.source), nodeId(d.target)].sort().join("-");
}

function isCrossRegional(d, byId) {
    return byId.get(nodeId(d.source)).region !== byId.get(nodeId(d.target)).region;
}

function calculateVolume(companyId, currentLinks) {
    return d3.sum(
        currentLinks.filter(d =>
            nodeId(d.source) === companyId || nodeId(d.target) === companyId
        ),
        d => d.amount_usd
    );
}

function nodePath(d, radius) {
    return d3.symbol()
        .type(regionSymbol[d.region])
        .size(Math.max(40, Math.PI * radius * radius))();
}

Promise.all([
    d3.csv("../data/lab7_assignment_companies.csv", d => ({
        id: d.id,
        company_name: d.company_name,
        sector: d.sector,
        region: d.region
    })),
    d3.csv("../data/lab7_assignment_transactions_60days.csv", d => ({
        date: parseDate(d.date),
        day: +d.day,
        source: d.source,
        target: d.target,
        amount_usd: +d.amount_usd,
        transaction_type: d.transaction_type,
        transaction_count: +d.transaction_count
    }))
]).then(([companies, transactions]) => {
    drawNetwork(companies, transactions);
});

function drawNetwork(companies, transactions) {
    const byId = new Map(companies.map(d => [d.id, d]));
    const maxDay = d3.max(transactions, d => d.day);
    const minDay = d3.min(transactions, d => d.day);

    companies.forEach((d, i) => {
        const columnJitter = ((i % 4) - 1.5) * 36;
        d.x = regionX[d.region] + columnJitter;
        d.y = height / 2 - 40 + ((i % 4) - 1.5) * 70;
    });

    const dailyStats = d3.range(minDay, maxDay + 1).map(day => {
        const links = transactions.filter(d => d.day === day);
        const active = new Set(links.flatMap(d => [d.source, d.target]));
        return {
            day,
            date: links[0].date,
            nLinks: links.length,
            nCompanies: active.size,
            value: d3.sum(links, d => d.amount_usd),
            nCross: links.filter(d => isCrossRegional(d, byId)).length
        };
    });

    const maxVolume = d3.max(d3.range(minDay, maxDay + 1), day => {
        const links = transactions.filter(d => d.day === day);
        return d3.max(companies, company => calculateVolume(company.id, links));
    });

    const sizeScale = d3.scaleSqrt()
        .domain([0, maxVolume])
        .range([8, 28]);

    const widthScale = d3.scaleLinear()
        .domain(d3.extent(transactions, d => d.amount_usd))
        .range([1.4, 7]);

    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height);

    svg.selectAll(".region-band")
        .data(Object.entries(regionX))
        .join("rect")
        .attr("class", "region-band")
        .attr("x", d => d[1] - 150)
        .attr("y", margin.top)
        .attr("width", 300)
        .attr("height", height - margin.top - margin.bottom)
        .attr("fill", "rgba(255,255,255,0.015)")
        .attr("rx", 18);

    svg.selectAll(".region-label")
        .data(Object.entries(regionX))
        .join("text")
        .attr("class", "region-label")
        .attr("x", d => d[1])
        .attr("y", 28)
        .attr("text-anchor", "middle")
        .text(d => d[0]);

    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");

    const activityX = d3.scaleBand()
        .domain(dailyStats.map(d => d.day))
        .range([margin.left, width - margin.right])
        .padding(0.18);

    const activityY = d3.scaleLinear()
        .domain([0, d3.max(dailyStats, d => d.value)])
        .range([height - 18, height - 72]);

    svg.append("text")
        .attr("x", margin.left)
        .attr("y", height - 78)
        .attr("fill", "#8e99ad")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.08em")
        .text("DAILY TRANSACTION VALUE — CLICK A BAR TO INSPECT THAT DAY");

    const activityBars = svg.append("g")
        .selectAll(".activity-bar")
        .data(dailyStats)
        .join("rect")
        .attr("class", "activity-bar")
        .attr("x", d => activityX(d.day))
        .attr("y", d => activityY(d.value))
        .attr("width", activityX.bandwidth())
        .attr("height", d => activityY(0) - activityY(d.value))
        .attr("rx", 1.5)
        .attr("fill", "#4c5872");

    const simulation = d3.forceSimulation(companies)
        .force("link", d3.forceLink([]).id(d => d.id).distance(140).strength(0.16))
        .force("charge", d3.forceManyBody().strength(-180))
        .force("x", d3.forceX(d => regionX[d.region]).strength(0.32))
        .force("y", d3.forceY((height - 40) / 2).strength(0.1))
        .force("collide", d3.forceCollide().radius(22).strength(0.9))
        .alphaDecay(0.05);

    let currentDay = 1;
    let timer = null;
    let currentLinks = [];

    const node = nodeGroup.selectAll(".company")
        .data(companies, d => d.id)
        .join(enter => {
            const g = enter.append("g").attr("class", "company");
            g.append("path").attr("class", "company-shape");
            g.append("text")
                .attr("class", "company-label")
                .attr("text-anchor", "middle")
                .attr("dy", 0);
            return g;
        });

    node
        .on("mouseover", function (event, d) {
            d3.select(this).classed("is-hovered", true);
            const volume = calculateVolume(d.id, currentLinks);
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.company_name}</strong><br>
                    ${d.id} · ${d.sector} · ${d.region}<br>
                    Today's volume: ${formatMoney(volume)}
                `);
        })
        .on("mousemove", event => {
            tooltip
                .style("left", `${event.clientX + 12}px`)
                .style("top", `${event.clientY + 12}px`);
        })
        .on("mouseout", function () {
            d3.select(this).classed("is-hovered", false);
            tooltip.style("opacity", 0);
        })
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) {
                    simulation.alphaTarget(0.12).restart();
                }
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", (event, d) => {
                if (!event.active) {
                    simulation.alphaTarget(0);
                }
                d.fx = null;
                d.fy = null;
            }));

    function linksForDay(day) {
        return transactions
            .filter(d => d.day === day)
            .map(d => ({
                source: d.source,
                target: d.target,
                amount_usd: d.amount_usd,
                transaction_type: d.transaction_type,
                transaction_count: d.transaction_count,
                date: d.date,
                day: d.day
            }));
    }

    function showDay(day, { animate = true } = {}) {
        currentDay = day;
        currentLinks = linksForDay(day);
        const duration = animate ? 380 : 0;

        d3.select("#time-slider").property("value", day);
        const stats = dailyStats[day - 1];
        d3.select("#status").html(`
            <strong>Day ${stats.day}</strong>
            · ${formatDate(stats.date)}
            · Active companies: ${stats.nCompanies}
            · Active links: ${stats.nLinks}
            · Total value: ${formatMoney(stats.value)}
            · Cross-regional links: ${stats.nCross} of ${stats.nLinks}
        `);

        activityBars.attr("fill", d => (d.day === day ? "#9da9ff" : "#4c5872"));

        const link = linkGroup
            .selectAll("line")
            .data(currentLinks, linkKey)
            .join(
                enter => enter.append("line")
                    .attr("class", "link")
                    .attr("stroke", d => typeColors[d.transaction_type])
                    .attr("stroke-width", d => widthScale(d.amount_usd))
                    .attr("stroke-linecap", "round")
                    .attr("opacity", 0)
                    .call(enterSel => enterSel.transition().duration(duration)
                        .attr("opacity", 0.82)),
                update => update
                    .attr("stroke", d => typeColors[d.transaction_type])
                    .call(updateSel => updateSel.transition().duration(duration)
                        .attr("stroke-width", d => widthScale(d.amount_usd))
                        .attr("opacity", 0.82)),
                exit => exit.transition().duration(duration)
                    .attr("opacity", 0)
                    .remove()
            );

        link
            .on("mouseover", function (event, d) {
                d3.select(this).classed("is-hovered", true);
                const source = byId.get(nodeId(d.source));
                const target = byId.get(nodeId(d.target));
                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${source.company_name} — ${target.company_name}</strong><br>
                        ${dateLabelFormat(d.date)} · Day ${d.day}<br>
                        Type: ${d.transaction_type}<br>
                        Amount: ${formatMoney(d.amount_usd)}<br>
                        Transactions: ${d.transaction_count}<br>
                        ${isCrossRegional(d, byId) ? "Cross-regional" : "Same region"}
                    `);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", `${event.clientX + 12}px`)
                    .style("top", `${event.clientY + 12}px`);
            })
            .on("mouseout", function () {
                d3.select(this).classed("is-hovered", false);
                tooltip.style("opacity", 0);
            });

        node.each(d => {
            d.volume = calculateVolume(d.id, currentLinks);
            d.radius = sizeScale(d.volume);
        });

        node.select(".company-shape")
            .attr("fill", d => sectorColors[d.sector])
            .attr("stroke", d => (d.volume > 0 ? "rgba(243,246,255,0.9)" : "rgba(243,246,255,0.2)"))
            .attr("stroke-width", d => (d.volume > 0 ? 2 : 1))
            .attr("opacity", d => (d.volume > 0 ? 1 : 0.38))
            .transition()
            .duration(duration)
            .attr("d", d => nodePath(d, d.radius));

        node.select(".company-label")
            .attr("y", d => d.radius + 14)
            .text(d => d.company_name);

        simulation.force("link").links(currentLinks);
        simulation.force("collide").radius(d => d.radius + 16);
        simulation.alpha(0.28).restart();
    }

    simulation.on("tick", () => {
        linkGroup.selectAll("line")
            .attr("x1", d => (typeof d.source === "object" ? d.source.x : byId.get(d.source).x))
            .attr("y1", d => (typeof d.source === "object" ? d.source.y : byId.get(d.source).y))
            .attr("x2", d => (typeof d.target === "object" ? d.target.x : byId.get(d.target).x))
            .attr("y2", d => (typeof d.target === "object" ? d.target.y : byId.get(d.target).y));

        node.attr("transform", d => {
            d.x = Math.max(margin.left + 40, Math.min(width - margin.right - 40, d.x));
            d.y = Math.max(margin.top + 24, Math.min(height - margin.bottom - 8, d.y));
            return `translate(${d.x},${d.y})`;
        });
    });

    function play() {
        if (timer) {
            return;
        }
        if (currentDay >= maxDay) {
            showDay(minDay);
        }
        timer = d3.interval(() => {
            if (currentDay >= maxDay) {
                pause();
                return;
            }
            showDay(currentDay + 1);
        }, 700);
    }

    function pause() {
        if (timer) {
            timer.stop();
            timer = null;
        }
    }

    function reset() {
        pause();
        showDay(minDay);
    }

    d3.select("#play").on("click", play);
    d3.select("#pause").on("click", pause);
    d3.select("#reset").on("click", reset);
    d3.select("#time-slider")
        .attr("min", minDay)
        .attr("max", maxDay)
        .on("input", function () {
            pause();
            showDay(+this.value);
        });

    activityBars.on("click", (event, d) => {
        pause();
        showDay(d.day);
    });

    drawLegend();
    showDay(minDay, { animate: false });
}

function drawLegend() {
    const legend = d3.select("#legend");
    legend.html("");

    const sectorBlock = legend.append("div").attr("class", "legend-block");
    sectorBlock.append("div").attr("class", "legend-title").text("Sector (node color)");
    Object.entries(sectorColors).forEach(([name, color]) => {
        const row = sectorBlock.append("div").attr("class", "legend-row");
        row.append("span").attr("class", "legend-swatch").style("background", color);
        row.append("span").text(name);
    });

    const regionBlock = legend.append("div").attr("class", "legend-block");
    regionBlock.append("div").attr("class", "legend-title").text("Region (shape / column)");
    [
        ["Asia", "circle"],
        ["Europe", "square"],
        ["North America", "triangle"]
    ].forEach(([name, shape]) => {
        const row = regionBlock.append("div").attr("class", "legend-row");
        const mark = row.append("svg")
            .attr("class", "legend-shape")
            .attr("viewBox", "0 0 16 16");
        const symbol = shape === "square"
            ? d3.symbolSquare
            : shape === "triangle"
                ? d3.symbolTriangle
                : d3.symbolCircle;
        mark.append("path")
            .attr("transform", "translate(8,8)")
            .attr("d", d3.symbol().type(symbol).size(70)())
            .attr("fill", "#f3f6ff");
        row.append("span").text(name);
    });

    const typeBlock = legend.append("div").attr("class", "legend-block");
    typeBlock.append("div").attr("class", "legend-title").text("Transaction type (link color)");
    Object.entries(typeColors).forEach(([name, color]) => {
        const row = typeBlock.append("div").attr("class", "legend-row");
        row.append("span")
            .attr("class", "legend-swatch is-line")
            .style("background", color);
        row.append("span").text(name);
    });

    const sizeBlock = legend.append("div").attr("class", "legend-block");
    sizeBlock.append("div").attr("class", "legend-title").text("Dynamic size / width");
    sizeBlock.append("div").attr("class", "legend-row")
        .text("Node size: that day's transaction volume.");
    sizeBlock.append("div").attr("class", "legend-row")
        .text("Link width: that day's amount (USD).");
    sizeBlock.append("div").attr("class", "legend-row")
        .text("Bright outline: the company traded today.");
}
