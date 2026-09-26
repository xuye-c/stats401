const DATA_URL = "../data/critique_water.json";

const viewWidth = 960;
const viewHeight = 440;
const thinSlice = 18;
const padBelow = 18;
const dominate = 0.8;
const keepShare = 0.08;

const groupColors = {
    salt: "#7eb0c9",
    fresh: "#8ed4b0",
    insect: "#8aa4f0",
    tree: "#6e9b5b",
    animal: "#d9c6a3",
    human: "#e24b5b",
    other: "#d9c6a3",
    flow: "#9da9ff",
    product: "#9da9ff"
};

const tooltip = d3.select("#tooltip");

function formatKm3(value) {
    if (value >= 100) {
        return d3.format(",.0f")(value);
    }
    if (value >= 10) {
        return d3.format(",.1f")(value);
    }
    if (value >= 1) {
        return d3.format(",.2f")(value);
    }
    return d3.format(".4f")(value).replace(/0+$/, "").replace(/\.$/, "");
}

function formatShare(part, whole) {
    if (!whole) {
        return "—";
    }
    const ratio = part / whole;
    if (ratio > 0.999 && ratio < 1) {
        return d3.format(".3%")(ratio);
    }
    if (ratio > 0.99 && ratio < 1) {
        return d3.format(".2%")(ratio);
    }
    if (ratio >= 0.01) {
        return d3.format(".1%")(ratio);
    }
    if (ratio >= 0.0001) {
        return d3.format(".2%")(ratio);
    }
    if (ratio > 0 && ratio < 0.000005) {
        return "<0.001%";
    }
    return d3.format(".3%")(ratio);
}

function valueOf(node) {
    if (node.value != null) {
        return node.value;
    }
    if (node.children && node.children.length) {
        return d3.sum(node.children, valueOf);
    }
    return node.km3 || 0;
}

function makeOther(nodes) {
    return {
        name: "Other",
        other: true,
        group: "other",
        children: nodes,
        value: d3.sum(nodes, valueOf)
    };
}

function asPart(node) {
    return {
        name: node.name,
        group: node.group || "other",
        other: !!node.other,
        children: node.children || [],
        value: valueOf(node),
        source: node
    };
}

function partsOf(node, isRoot) {
    const kids = node.children || [];
    if (!kids.length) {
        return [asPart(node)];
    }
    if (kids.length === 1) {
        return [asPart(kids[0])];
    }

    const total = d3.sum(kids, valueOf);
    const sorted = kids.slice().sort((a, b) => valueOf(b) - valueOf(a));
    const largestShare = valueOf(sorted[0]) / total;

    if (!isRoot && largestShare >= dominate && sorted.length > 2) {
        return [asPart(sorted[0]), makeOther(sorted.slice(1))];
    }

    if (!isRoot) {
        const kept = [];
        const rest = [];
        sorted.forEach(child => {
            if (valueOf(child) / total >= keepShare) {
                kept.push(child);
            } else {
                rest.push(child);
            }
        });
        if (rest.length >= 2 && kids.length > 4) {
            return kept.map(asPart).concat([makeOther(rest)]);
        }
    }

    return sorted.map(asPart);
}

function layoutParts(parts) {
    const data = {
        name: "view",
        children: parts.map(part => ({
            name: part.name,
            km3: part.value
        }))
    };
    const root = d3.hierarchy(data)
        .sum(d => d.km3 || 0)
        .sort((a, b) => b.value - a.value);

    d3.treemap()
        .tile(parts.length === 2 ? d3.treemapDice : d3.treemapSquarify)
        .size([viewWidth, viewHeight])
        .paddingInner(4)
        .paddingOuter(2)
        .round(true)(root);

    const boxes = parts.map(part => {
        const leaf = root.leaves().find(d => d.data.name === part.name);
        return {
            ...part,
            x0: leaf.x0,
            y0: leaf.y0,
            x1: leaf.x1,
            y1: leaf.y1,
            padded: false
        };
    });

    const narrow = boxes.filter(d => Math.min(d.x1 - d.x0, d.y1 - d.y0) <= padBelow);
    if (!narrow.length) {
        return boxes;
    }

    const reserved = narrow.length * thinSlice;
    const wide = boxes.filter(d => Math.min(d.x1 - d.x0, d.y1 - d.y0) > padBelow);
    const wideWeight = d3.sum(wide, d => d.value) || 1;
    let x = 2;
    const ordered = boxes.slice().sort((a, b) => a.x0 - b.x0);
    ordered.forEach(d => {
        const narrowSlice = Math.min(d.x1 - d.x0, d.y1 - d.y0) <= padBelow;
        const span = narrowSlice
            ? thinSlice
            : Math.max(thinSlice, (viewWidth - 4 - reserved) * (d.value / wideWeight));
        d.x0 = x;
        d.x1 = x + span;
        d.y0 = 2;
        d.y1 = viewHeight - 2;
        const trueWidth = d.value / d3.sum(parts, p => p.value) * viewWidth;
        d.padded = narrowSlice && trueWidth < thinSlice;
        x += span;
    });
    const scale = (viewWidth - 2) / x;
    if (scale < 1) {
        ordered.forEach(d => {
            d.x0 = 2 + (d.x0 - 2) * scale;
            d.x1 = 2 + (d.x1 - 2) * scale;
        });
    }
    return boxes;
}

function canOpen(part) {
    return part.other || (part.children && part.children.length > 0);
}

function pathToNode(root, target) {
    const trail = [];

    function walk(node) {
        trail.push(node);
        if (node === target) {
            return true;
        }
        if (node.children) {
            for (const child of node.children) {
                if (walk(child)) {
                    return true;
                }
            }
        }
        trail.pop();
        return false;
    }

    walk(root);
    return trail;
}

function drawStaticLegend(host, entries) {
    const legend = host.append("div").attr("class", "legend");
    entries.forEach(entry => {
        const row = legend.append("div").attr("class", "legend-row");
        row.append("span")
            .attr("class", "legend-swatch")
            .style("background", groupColors[entry.group]);
        row.append("span").text(entry.name);
    });
}

function bindShareRow(rows, total, rootValue, onOpen) {
    rows
        .on("click", (event, d) => {
            event.stopPropagation();
            hideTooltip();
            onOpen(d);
        })
        .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).classed("is-hovered", true);
            const lines = [
                `<strong>${d.name}</strong>`,
                `${formatKm3(d.value)} km³`,
                `${formatShare(d.value, total)} of this view`,
                `${formatShare(d.value, rootValue)} of biological water`
            ];
            if (canOpen(d)) {
                lines.push("<em>Click to open</em>");
            }
            tooltip.style("opacity", 1).html(lines.join("<br>"));
            placeTooltip(event);
        })
        .on("mousemove", event => {
            placeTooltip(event);
        })
        .on("mouseout", event => {
            d3.select(event.currentTarget).classed("is-hovered", false);
            tooltip.style("opacity", 0);
        });
}

function drawTreeInset(stage, parts, total, rootValue, onOpen) {
    const byName = Object.fromEntries(parts.map(part => [part.name, part]));
    const trees = byName.Trees;
    const insects = byName.Insects;
    const other = byName.Other;
    const labelWidth = 188;
    const plotWidth = 500;
    const valueWidth = 132;
    const width = labelWidth + plotWidth + valueWidth;
    const insetTop = 54;
    const insetHeight = 96;
    const height = insetTop + insetHeight + 12;
    const xInset = d3.scaleLinear()
        .domain([0, Math.max(insects.value, other.value)])
        .range([0, plotWidth - 28]);

    stage.html("");
    const svg = stage.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height);

    const treeRow = svg.append("g")
        .datum(trees)
        .attr("class", "leaf is-leaf")
        .attr("transform", "translate(0,6)");
    treeRow.append("rect")
        .attr("class", "bar-hit")
        .attr("width", width)
        .attr("height", 40)
        .attr("fill", "transparent");
    treeRow.append("rect")
        .attr("class", "bar-swatch")
        .attr("x", 10)
        .attr("y", 8)
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 2)
        .attr("fill", groupColors.tree);
    treeRow.append("text")
        .attr("class", "row-label")
        .attr("x", 32)
        .attr("y", 20)
        .text(trees.name);
    treeRow.append("rect")
        .attr("class", "bar-track")
        .attr("x", labelWidth)
        .attr("y", 6)
        .attr("width", plotWidth)
        .attr("height", 18)
        .attr("rx", 3);
    treeRow.append("rect")
        .attr("class", "bar-fill")
        .attr("x", labelWidth)
        .attr("y", 6)
        .attr("width", plotWidth)
        .attr("height", 18)
        .attr("rx", 3)
        .attr("fill", groupColors.tree);
    treeRow.append("text")
        .attr("class", "row-value")
        .attr("x", labelWidth + plotWidth + 12)
        .attr("y", 20)
        .text(`${formatKm3(trees.value)} km³`);
    bindShareRow(treeRow, total, rootValue, onOpen);

    const small = svg.selectAll(".small-row")
        .data([insects, other])
        .join("g")
        .attr("class", d => `leaf small-row${d.other ? " is-other" : ""}${canOpen(d) ? " can-open" : " is-leaf"}`)
        .attr("transform", (_, i) => `translate(0,${insetTop + i * 24})`);
    small.append("rect")
        .attr("class", "bar-hit")
        .attr("width", labelWidth - 8)
        .attr("height", 22)
        .attr("fill", "transparent");
    small.append("rect")
        .attr("class", "bar-swatch")
        .attr("x", 10)
        .attr("y", 3)
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 2)
        .attr("fill", d => groupColors[d.group] || groupColors.other)
        .attr("stroke", d => (d.other ? "rgba(243, 246, 255, 0.7)" : "rgba(255, 255, 255, 0.28)"))
        .attr("stroke-dasharray", d => (d.other ? "3 2" : null));
    small.append("text")
        .attr("class", "row-label")
        .attr("x", 32)
        .attr("y", 15)
        .text(d => d.name);
    small.append("text")
        .attr("class", "row-value")
        .attr("x", 96)
        .attr("y", 15)
        .text(d => `${formatKm3(d.value)} km³`);
    bindShareRow(small, total, rootValue, onOpen);

    const inset = svg.append("g")
        .attr("class", "scale-inset")
        .attr("transform", `translate(${labelWidth},${insetTop})`);
    inset.append("rect")
        .attr("class", "inset-frame")
        .attr("width", plotWidth + valueWidth - 8)
        .attr("height", insetHeight)
        .attr("rx", 8);
    inset.append("text")
        .attr("class", "inset-title")
        .attr("x", 12)
        .attr("y", 18)
        .text("Enlarged scale");

    const insetRows = inset.selectAll(".inset-row")
        .data([insects, other])
        .join("g")
        .attr("class", d => `leaf inset-row${d.other ? " is-other" : ""}${canOpen(d) ? " can-open" : " is-leaf"}`)
        .attr("transform", (_, i) => `translate(12,${30 + i * 30})`);
    insetRows.append("rect")
        .attr("class", "bar-hit")
        .attr("width", plotWidth + valueWidth - 32)
        .attr("height", 26)
        .attr("fill", "transparent");
    insetRows.append("text")
        .attr("class", "row-label")
        .attr("x", 0)
        .attr("y", 14)
        .text(d => d.name);
    insetRows.append("rect")
        .attr("class", "bar-track")
        .attr("x", 72)
        .attr("y", 2)
        .attr("width", plotWidth - 28)
        .attr("height", 14)
        .attr("rx", 3);
    insetRows.append("rect")
        .attr("class", "bar-fill")
        .attr("x", 72)
        .attr("y", 2)
        .attr("width", d => xInset(d.value))
        .attr("height", 14)
        .attr("rx", 3)
        .attr("fill", d => groupColors[d.group] || groupColors.other);
    bindShareRow(insetRows, total, rootValue, onOpen);
}

function drawShareRows(stage, parts, total, rootValue, onOpen) {
    const names = parts.map(part => part.name).sort().join("|");
    if (names === "Insects|Other|Trees") {
        drawTreeInset(stage, parts, total, rootValue, onOpen);
        return;
    }

    const labelWidth = 150;
    const plotWidth = 520;
    const valueWidth = 140;
    const rowHeight = 46;
    const width = labelWidth + plotWidth + valueWidth;
    const height = parts.length * rowHeight + 8;
    const maxValue = d3.max(parts, d => d.value) || 1;
    const x = d3.scaleLinear().domain([0, maxValue]).range([0, plotWidth]);

    stage.html("");
    const svg = stage.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height);

    const rows = svg.selectAll("g")
        .data(parts, d => d.name)
        .join("g")
        .attr("class", d => `leaf${d.other ? " is-other" : ""}${canOpen(d) ? " can-open" : " is-leaf"}`)
        .attr("transform", (_, i) => `translate(0,${i * rowHeight + 6})`);

    rows.append("rect")
        .attr("class", "bar-hit")
        .attr("width", width)
        .attr("height", rowHeight - 6)
        .attr("fill", "transparent");

    rows.append("rect")
        .attr("class", "bar-swatch")
        .attr("x", 10)
        .attr("y", 8)
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 2)
        .attr("fill", d => groupColors[d.group] || groupColors.other)
        .attr("stroke", d => (d.other ? "rgba(243, 246, 255, 0.7)" : "rgba(255, 255, 255, 0.28)"))
        .attr("stroke-width", d => (d.other ? 1.4 : 0.8))
        .attr("stroke-dasharray", d => (d.other ? "3 2" : null));

    rows.append("text")
        .attr("class", "row-label")
        .attr("x", 32)
        .attr("y", 19)
        .text(d => d.name);

    rows.append("rect")
        .attr("class", "bar-track")
        .attr("x", labelWidth)
        .attr("y", 6)
        .attr("width", plotWidth)
        .attr("height", 18)
        .attr("rx", 3);

    rows.append("rect")
        .attr("class", "bar-fill")
        .attr("x", labelWidth)
        .attr("y", 6)
        .attr("width", d => x(d.value))
        .attr("height", 18)
        .attr("rx", 3)
        .attr("fill", d => groupColors[d.group] || groupColors.other);

    rows.append("text")
        .attr("class", "row-value")
        .attr("x", labelWidth + plotWidth + 12)
        .attr("y", 19)
        .text(d => `${formatKm3(d.value)} km³`);

    bindShareRow(rows, total, rootValue, onOpen);
}

function drawTreemap(selector, data, legendEntries, options = {}) {
    const useBars = options.bars === true;
    const host = d3.select(selector);
    host.classed("treemap", false).classed("treemap-layout", true);

    const treeHost = host.append("aside").attr("class", "tree-nav");
    treeHost.append("div").attr("class", "tree-heading").text("Hierarchy");
    const treeBody = treeHost.append("div").attr("class", "tree-body");

    const main = host.append("div").attr("class", "treemap-main");
    const nav = main.append("div").attr("class", "treemap-nav");
    let svg = null;
    let stage = null;
    if (useBars) {
        stage = main.append("div").attr("class", "share-bars");
    } else {
        svg = main.append("svg")
            .attr("viewBox", `0 0 ${viewWidth} ${viewHeight}`)
            .attr("width", viewWidth)
            .attr("height", viewHeight);
        const clipId = `${selector.replace("#", "")}-zoom-clip`;
        svg.append("defs")
            .append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("width", viewWidth)
            .attr("height", viewHeight);
        stage = svg.append("g").attr("clip-path", `url(#${clipId})`);
    }
    drawStaticLegend(main, legendEntries);
    const stack = [data];
    const openNodes = new Set([data]);
    let currentParts = [];
    let zooming = false;

    function currentNode() {
        for (let i = stack.length - 1; i >= 0; i -= 1) {
            if (!stack[i].other) {
                return stack[i];
            }
        }
        return data;
    }

    function renderTree() {
        const current = currentNode();
        treeBody.html("");
        const list = treeBody.append("ul");

        function addNodes(ul, nodes, parentValue) {
            nodes.forEach(node => {
                const share = formatShare(valueOf(node), parentValue);
                const hasChildren = node.children && node.children.length > 0;
                const isOpen = openNodes.has(node);
                const li = ul.append("li");
                const row = li.append("div")
                    .attr("class", `tree-row${node === current ? " is-current" : ""}`);

                if (hasChildren) {
                    row.append("button")
                        .attr("type", "button")
                        .attr("class", "tree-toggle")
                        .attr("aria-label", isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`)
                        .text(isOpen ? "▾" : "▸")
                        .on("click", event => {
                            event.stopPropagation();
                            if (isOpen) {
                                openNodes.delete(node);
                            } else {
                                openNodes.add(node);
                            }
                            renderTree();
                        });
                } else {
                    row.append("span").attr("class", "tree-toggle is-empty");
                }

                row.append("button")
                    .attr("type", "button")
                    .attr("class", "tree-label")
                    .text(node.name)
                    .on("click", () => {
                        hideTooltip();
                        const trail = pathToNode(data, node);
                        const focus = stack[stack.length - 1];
                        if (!trail.length || trail[trail.length - 1] === focus || zooming) {
                            return;
                        }
                        const visible = currentParts.find(part => (part.source || part) === node || part.name === node.name);
                        const ancestorAt = stack.indexOf(node);
                        const leaving = ancestorAt !== -1 ? stack[ancestorAt + 1] : null;
                        stack.splice(0, stack.length, ...trail);
                        if (useBars) {
                            render();
                        } else if (visible) {
                            render({ mode: "in", rect: visible });
                        } else if (leaving) {
                            render({ mode: "out", name: leaving.name });
                        } else {
                            render();
                        }
                    });

                row.append("span")
                    .attr("class", "tree-share")
                    .text(share);

                if (hasChildren && isOpen) {
                    addNodes(li.append("ul"), node.children, valueOf(node));
                }
            });
        }

        addNodes(list, [data], valueOf(data));
    }

    function render(motion) {
        const focus = stack[stack.length - 1];
        const opened = partsOf(focus, stack.length === 1);
        const parts = useBars ? opened : layoutParts(opened);
        const total = d3.sum(parts, d => d.value);
        const rootValue = valueOf(data);
        currentParts = parts;

        stack.forEach(node => {
            if (!node.other) {
                openNodes.add(node);
            }
        });
        renderTree();

        nav.selectAll("span").remove();
        stack.forEach((node, i) => {
            if (i > 0) {
                nav.append("span").attr("class", "crumb-sep").text(" / ");
            }
            nav.append("span")
                .attr("class", i === stack.length - 1 ? "crumb is-current" : "crumb")
                .text(`${node.name} · ${formatKm3(valueOf(node))} km³`)
                .on("click", event => {
                    event.stopPropagation();
                    hideTooltip();
                    if (i >= stack.length - 1 || zooming) {
                        return;
                    }
                    const leaving = stack[stack.length - 1];
                    stack.splice(i + 1);
                    render(useBars ? undefined : { mode: "out", name: leaving.name });
                });
        });

        if (useBars) {
            drawShareRows(stage, parts, total, rootValue, part => {
                if (!canOpen(part) || zooming) {
                    return;
                }
                let node = part.source || part;
                if (node.other && node.children.length === 1) {
                    node = node.children[0];
                }
                stack.push(node);
                render();
            });
            return;
        }

        const cells = stage.selectAll(".leaf")
            .data(parts, d => d.name)
            .join("g")
            .attr("class", d => `leaf${d.other ? " is-other" : ""}${canOpen(d) ? "" : " is-leaf"}`)
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        cells.selectAll("rect")
            .data(d => [d])
            .join("rect")
            .attr("width", d => Math.max(0, d.x1 - d.x0))
            .attr("height", d => Math.max(0, d.y1 - d.y0))
            .attr("rx", d => Math.min(6, (d.x1 - d.x0) / 2))
            .attr("fill", d => groupColors[d.group] || groupColors.other)
            .attr("stroke", d => (d.other ? "rgba(8, 11, 18, 0.55)" : "rgba(8, 11, 18, 0.28)"))
            .attr("stroke-width", d => (d.other ? 1.6 : 0.8))
            .attr("stroke-dasharray", d => (d.other ? "5 4" : null));

        cells.selectAll("text").remove();

        cells.append("text")
            .attr("class", "leaf-label")
            .attr("x", 8)
            .attr("y", 18)
            .text(d => d.name)
            .style("opacity", d => ((d.x1 - d.x0) > 52 && (d.y1 - d.y0) > 22 ? 1 : 0));

        cells.append("text")
            .attr("class", "leaf-label sub")
            .attr("x", 8)
            .attr("y", 34)
            .text(d => `${formatKm3(d.value)} km³`)
            .style("opacity", d => ((d.x1 - d.x0) > 64 && (d.y1 - d.y0) > 40 ? 1 : 0));

        if (motion && motion.mode === "in" && motion.rect) {
            const w = Math.max(motion.rect.x1 - motion.rect.x0, 1);
            const h = Math.max(motion.rect.y1 - motion.rect.y0, 1);
            zooming = true;
            stage.interrupt()
                .attr("transform", `translate(${motion.rect.x0},${motion.rect.y0}) scale(${w / viewWidth},${h / viewHeight})`)
                .transition()
                .duration(650)
                .attr("transform", "translate(0,0) scale(1,1)")
                .on("end", () => {
                    zooming = false;
                });
        } else if (motion && motion.mode === "out") {
            const slot = parts.find(part => part.name === motion.name);
            stage.interrupt();
            if (slot && slot.x1 > slot.x0 && slot.y1 > slot.y0) {
                const sx = viewWidth / (slot.x1 - slot.x0);
                const sy = viewHeight / (slot.y1 - slot.y0);
                zooming = true;
                stage.attr("transform", `translate(${-slot.x0 * sx},${-slot.y0 * sy}) scale(${sx},${sy})`)
                    .transition()
                    .duration(650)
                    .attr("transform", "translate(0,0) scale(1,1)")
                    .on("end", () => {
                        zooming = false;
                    });
            } else {
                stage.attr("transform", null);
            }
        } else {
            stage.interrupt().attr("transform", null);
        }

        cells
            .on("click", (event, d) => {
                event.stopPropagation();
                hideTooltip();
                if (!canOpen(d) || zooming) {
                    return;
                }
                let node = d.source || d;
                if (node.other && node.children.length === 1) {
                    node = node.children[0];
                }
                stack.push(node);
                render({ mode: "in", rect: d });
            })
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget).classed("is-hovered", true);
                const lines = [
                    `<strong>${d.name}</strong>`,
                    `${formatKm3(d.value)} km³`,
                    `${formatShare(d.value, total)} of this view`,
                    `${formatShare(d.value, rootValue)} of ${data.name.toLowerCase()}`
                ];
                if (d.other) {
                    lines.push(`${d.children.length} reservoirs folded together`);
                }
                if (d.padded) {
                    lines.push("Drawn wider than its share, so it can be clicked");
                }
                if (canOpen(d)) {
                    lines.push("<em>Click to open</em>");
                }
                tooltip.style("opacity", 1).html(lines.join("<br>"));
                placeTooltip(event);
            })
            .on("mousemove", event => {
                placeTooltip(event);
            })
            .on("mouseout", event => {
                d3.select(event.currentTarget).classed("is-hovered", false);
                tooltip.style("opacity", 0);
            });
    }

    render();
}

function hideTooltip() {
    d3.selectAll(".leaf").classed("is-hovered", false);
    tooltip.style("opacity", 0);
}

function placeTooltip(event) {
    const pad = 14;
    const edge = 8;
    const tip = tooltip.node();
    tooltip.style("left", "0px").style("top", "0px");
    const rect = tip.getBoundingClientRect();
    let left = event.clientX + pad;
    let top = event.clientY + pad;
    if (left + rect.width > window.innerWidth - edge) {
        left = event.clientX - rect.width - pad;
    }
    if (top + rect.height > window.innerHeight - edge) {
        top = event.clientY - rect.height - pad;
    }
    left = Math.max(edge, Math.min(left, window.innerWidth - rect.width - edge));
    top = Math.max(edge, Math.min(top, window.innerHeight - rect.height - edge));
    tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

function drawBars(selector, rows) {
    const labelWidth = 220;
    const valueWidth = 180;
    const plotWidth = 460;
    const rowHeight = 38;
    const height = rows.length * rowHeight + 8;
    const width = labelWidth + plotWidth + valueWidth;
    const host = d3.select(selector);
    host.html("");

    const svg = host.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height);

    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.km3)])
        .range([0, plotWidth]);

    const groups = svg.selectAll("g")
        .data(rows)
        .join("g")
        .attr("transform", (_, i) => `translate(0,${i * rowHeight + 6})`);

    groups.append("text")
        .attr("class", "bar-label")
        .attr("x", labelWidth - 12)
        .attr("y", 17)
        .attr("text-anchor", "end")
        .text(d => d.name);

    groups.append("rect")
        .attr("x", labelWidth)
        .attr("y", 2)
        .attr("width", d => Math.max(4, x(d.km3)))
        .attr("height", 22)
        .attr("rx", 3)
        .attr("fill", d => groupColors[d.group] || "#9da9ff");

    groups.append("text")
        .attr("class", "bar-value")
        .attr("x", d => labelWidth + Math.max(4, x(d.km3)) + 8)
        .attr("y", 17)
        .text(d => `${formatKm3(d.km3)} km³${d.note ? ` (${d.note})` : ""}`);
}

d3.json(DATA_URL).then(data => {
    drawTreemap("#treemap-global", data.global, [
        { name: "Salt water", group: "salt" },
        { name: "Fresh water", group: "fresh" }
    ]);
    drawTreemap("#treemap-biological", data.biological, [
        { name: "Trees", group: "tree" },
        { name: "Insects", group: "insect" },
        { name: "Animals", group: "animal" },
        { name: "Humans", group: "human" }
    ], { bars: true });
    drawBars("#bars-use", data.use);
    drawBars("#bars-products", data.products);
});
