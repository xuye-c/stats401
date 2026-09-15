const DATA_URL = "../data/lab6_assignment_gdp.json";

const width = 960;
const height = 560;

const statusColors = {
    Increase: "#4fd2a5",
    Unchanged: "#8ea0c4",
    Decrease: "#e07a6b"
};

const tooltip = d3.select("#tooltip");

function ancestorAtDepth(node, depth) {
    let current = node;
    while (current && current.depth > depth) {
        current = current.parent;
    }
    return current;
}

function formatGdp(value) {
    return d3.format(",")(Math.round(value));
}

function pathToRoot(node) {
    const path = [];
    let current = node;
    while (current) {
        path.unshift(current);
        current = current.parent;
    }
    return path;
}

function nextZoomTarget(clicked, focus) {
    if (clicked === focus) {
        return focus.parent || focus;
    }

    let ancestor = focus;
    while (ancestor) {
        if (ancestor === clicked) {
            return clicked;
        }
        ancestor = ancestor.parent;
    }

    let node = clicked;
    while (node.parent && node.parent !== focus) {
        node = node.parent;
    }

    return node.parent === focus ? node : focus;
}

function drawLegend(selector) {
    const legend = d3.select(selector);
    legend.html("");

    const statusBlock = legend.append("div").attr("class", "legend-block");
    statusBlock.append("div").attr("class", "legend-title").text("GDP status");

    ["Increase", "Unchanged", "Decrease"].forEach(status => {
        const row = statusBlock.append("div").attr("class", "legend-row");
        row.append("span")
            .attr("class", "legend-swatch")
            .style("background", statusColors[status]);
        row.append("span").text(status);
    });

    const areaBlock = legend.append("div").attr("class", "legend-block");
    areaBlock.append("div").attr("class", "legend-title").text("GDP amount");
    areaBlock.append("div")
        .attr("class", "legend-row")
        .text("Rectangle area is GDP in billions of USD.");
}

function drawTreemap(selector, data, tile) {
    const root = d3.hierarchy(data)
        .sum(d => d.gdp || 0)
        .sort((a, b) => b.value - a.value);

    d3.treemap()
        .tile(tile)
        .size([width, height])
        .paddingInner(2)
        .paddingOuter(4)
        .paddingTop(22)
        (root);

    let focus = root;

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([0, height]);

    function setDomain(node) {
        x.domain([node.x0, node.x1]);
        y.domain([node.y0, node.y1]);
    }

    setDomain(root);

    const host = d3.select(selector);
    const nav = host.append("div").attr("class", "treemap-nav");
    const clipPrefix = selector.replace("#", "");
    const clipId = `${clipPrefix}-zoom-clip`;

    const svg = host
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height);

    svg.append("defs")
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    svg.append("rect")
        .attr("class", "zoom-back")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("click", () => zoomTo(focus.parent || root));

    const stage = svg.append("g")
        .attr("clip-path", `url(#${clipId})`);

    const parents = root.descendants().filter(d => d.depth === 1 || d.depth === 2);

    const parentLayer = stage.selectAll(".parent-node")
        .data(parents)
        .join("g")
        .attr("class", "parent-node")
        .attr("transform", d => `translate(${x(d.x0)},${y(d.y0)})`);

    parentLayer.append("rect")
        .attr("class", "parent-frame")
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr("height", d => Math.max(0, y(d.y1) - y(d.y0)))
        .attr("fill", "none")
        .attr("stroke", d => (d.depth === 1
            ? "rgba(243, 246, 255, 0.28)"
            : "rgba(243, 246, 255, 0.12)"))
        .attr("stroke-width", 1.2);

    parentLayer.append("text")
        .attr("class", d => (d.depth === 1 ? "parent-label" : "area-label"))
        .attr("x", 8)
        .attr("y", 15)
        .text(d => (d.depth === 1 && (d.x1 - d.x0) > 140
            ? `${d.data.name}  ·  ${formatGdp(d.value)}`
            : d.data.name));

    const leaves = stage.selectAll(".leaf")
        .data(root.leaves())
        .join("g")
        .attr("class", "leaf")
        .attr("transform", d => `translate(${x(d.x0)},${y(d.y0)})`);

    leaves.append("rect")
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr("height", d => Math.max(0, y(d.y1) - y(d.y0)))
        .attr("fill", d => statusColors[d.data.status])
        .attr("stroke", "rgba(8, 11, 18, 0.35)")
        .attr("stroke-width", 0.6);

    leaves.append("text")
        .attr("class", "leaf-label")
        .attr("x", 6)
        .attr("y", 16)
        .text(d => d.data.name);

    leaves.append("text")
        .attr("class", "leaf-label sub")
        .attr("x", 6)
        .attr("y", 30)
        .text(d => `${formatGdp(d.data.gdp)}`);

    function hideTooltip() {
        leaves.classed("is-hovered", false);
        tooltip.style("opacity", 0);
    }

    function updateBreadcrumb() {
        const crumbs = pathToRoot(focus);
        nav.selectAll("span").remove();

        crumbs.forEach((node, i) => {
            if (i > 0) {
                nav.append("span")
                    .attr("class", "crumb-sep")
                    .text(" / ");
            }

            nav.append("span")
                .attr("class", i === crumbs.length - 1 ? "crumb is-current" : "crumb")
                .text(`${node.data.name} · ${formatGdp(node.value)}`)
                .on("click", event => {
                    event.stopPropagation();
                    hideTooltip();
                    zoomTo(node);
                });
        });
    }

    function updateLabels(layer, duration) {
        layer.selectAll(".parent-label, .area-label")
            .transition()
            .duration(duration)
            .style("opacity", d => {
                const w = x(d.x1) - x(d.x0);
                const h = y(d.y1) - y(d.y0);
                const visible = d.parent === focus && w > 72 && h > 22;
                return visible ? 1 : 0;
            });

        leaves.select(".leaf-label")
            .transition()
            .duration(duration)
            .style("opacity", d => {
                const w = x(d.x1) - x(d.x0);
                const h = y(d.y1) - y(d.y0);
                return w > 52 && h > 22 ? 1 : 0;
            });

        leaves.select(".leaf-label.sub")
            .transition()
            .duration(duration)
            .style("opacity", d => {
                const w = x(d.x1) - x(d.x0);
                const h = y(d.y1) - y(d.y0);
                return w > 70 && h > 38 ? 1 : 0;
            });
    }

    function zoomTo(node) {
        if (!node || node === focus) {
            return;
        }

        focus = node;
        setDomain(focus);
        updateBreadcrumb();

        const duration = 650;

        parentLayer.transition()
            .duration(duration)
            .attr("transform", d => `translate(${x(d.x0)},${y(d.y0)})`);

        parentLayer.select("rect")
            .transition()
            .duration(duration)
            .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
            .attr("height", d => Math.max(0, y(d.y1) - y(d.y0)));

        leaves.transition()
            .duration(duration)
            .attr("transform", d => `translate(${x(d.x0)},${y(d.y0)})`);

        leaves.select("rect")
            .transition()
            .duration(duration)
            .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
            .attr("height", d => Math.max(0, y(d.y1) - y(d.y0)));

        updateLabels(parentLayer, duration);
    }

    leaves
        .on("click", function (event, d) {
            event.stopPropagation();
            hideTooltip();
            zoomTo(nextZoomTarget(d, focus));
        })
        .on("mouseover", function (event, d) {
            d3.select(this).classed("is-hovered", true);
            const continent = ancestorAtDepth(d, 1).data.name;
            const area = ancestorAtDepth(d, 2).data.name;
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.data.name}</strong><br>
                    Continent: ${continent}<br>
                    Area: ${area}<br>
                    GDP: ${formatGdp(d.data.gdp)} billion USD<br>
                    GDP status: ${d.data.status}<br>
                    <em>Click to zoom in</em>
                `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.clientX + 12}px`)
                .style("top", `${event.clientY + 12}px`);
        })
        .on("mouseout", function () {
            d3.select(this).classed("is-hovered", false);
            tooltip.style("opacity", 0);
        });

    updateBreadcrumb();
    updateLabels(parentLayer, 0);
}

d3.json(DATA_URL).then(data => {
    drawLegend("#legend");
    drawLegend("#legend-slicedice");
    drawTreemap("#treemap-squarify", data, d3.treemapSquarify);
    drawTreemap("#treemap-slicedice", data, d3.treemapSliceDice);
});
