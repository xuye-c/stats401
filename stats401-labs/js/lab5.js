const width = 1180;
const height = 900;
const margin = {
    top: 28,
    right: 20,
    bottom: 20,
    left: 20
};

const NODE_SIZE = 220;
const NODE_EDGE = 11;
const NODE_COLLIDE_RADIUS = 22;
const LINK_DISTANCE = 300;
const CENTRAL_SIZE = 260;

const cx = width / 2;
const cy = height / 2;

const centralBox = {
    x: cx - CENTRAL_SIZE / 2,
    y: cy - CENTRAL_SIZE / 2,
    width: CENTRAL_SIZE,
    height: CENTRAL_SIZE
};

const stationSymbol = {
    Local: d3.symbolCircle,
    Transfer: d3.symbolSquare,
    Terminal: d3.symbolTriangle
};

const routeColors = {
    Metro: "#8fb4c9",
    Express: "#b8d4a8",
    Shuttle: "#d4b8c8"
};

const districtColors = {
    Central: "#e6c35c",
    North: "#6ea8ff",
    South: "#e0896c",
    East: "#7dceae",
    West: "#c49be8"
};

const stationTypeOrder = ["Local", "Transfer", "Terminal"];

const inactiveLinkColor = "#3a4254";
const linkOpacity = 0.45;
const nodePad = 28;
const squareGap = 52;
const wedgePad = 20;
const ARROW_THICKNESS_RATIO = 5;
const ARROW_LENGTH_RATIO = 3.5;
const ARROW_MIN_THICKNESS = 4;
const ARROW_MIN_LENGTH = 8;

Promise.all([
    d3.csv(
        "../data/lab5_assignment_stations.csv",
        d => ({
            id: d.id,
            station_name: d.station_name,
            district: d.district,
            daily_passengers: +d.daily_passengers,
            station_type: d.station_type
        })
    ),
    d3.csv(
        "../data/lab5_assignment_routes.csv",
        d => ({
            source: d.source,
            target: d.target,
            travel_time_min: +d.travel_time_min,
            route_type: d.route_type
        })
    )
])
.then(([stations, routes]) => {
    drawNodeLink(stations, routes);
    drawAdjacencyMatrix(stations, routes);
});

function districtCenter(name) {
    if (name === "Central") {
        return { x: cx, y: cy };
    }
    if (name === "North") {
        return { x: cx, y: (margin.top + centralBox.y) / 2 };
    }
    if (name === "South") {
        return {
            x: cx,
            y: (centralBox.y + CENTRAL_SIZE + height - margin.bottom) / 2
        };
    }
    if (name === "West") {
        return { x: (margin.left + centralBox.x) / 2, y: cy };
    }
    return {
        x: (centralBox.x + CENTRAL_SIZE + width - margin.right) / 2,
        y: cy
    };
}

function initialPosition(district) {
    const jitter = () => Math.random() - 0.5;

    if (district === "Central") {
        return {
            x: cx + jitter() * (CENTRAL_SIZE * 0.4),
            y: cy + jitter() * (CENTRAL_SIZE * 0.4)
        };
    }
    if (district === "North") {
        return {
            x: cx + jitter() * 240,
            y: margin.top + 80 + Math.random() * 70
        };
    }
    if (district === "South") {
        return {
            x: cx + jitter() * 240,
            y: height - margin.bottom - 80 - Math.random() * 70
        };
    }
    if (district === "West") {
        return {
            x: margin.left + 80 + Math.random() * 70,
            y: cy + jitter() * 160
        };
    }
    return {
        x: width - margin.right - 80 - Math.random() * 70,
        y: cy + jitter() * 160
    };
}

function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function clampToCanvas(d) {
    d.x = clampValue(d.x, margin.left + nodePad, width - margin.right - nodePad);
    d.y = clampValue(d.y, margin.top + nodePad, height - margin.bottom - nodePad);
}

function pushOutOfCentralSquare(d) {
    const left = centralBox.x - squareGap;
    const right = centralBox.x + CENTRAL_SIZE + squareGap;
    const top = centralBox.y - squareGap;
    const bottom = centralBox.y + CENTRAL_SIZE + squareGap;
    const inside =
        d.x > left &&
        d.x < right &&
        d.y > top &&
        d.y < bottom;

    if (!inside) {
        return;
    }

    if (d.district === "North") {
        d.y = top;
    } else if (d.district === "South") {
        d.y = bottom;
    } else if (d.district === "West") {
        d.x = left;
    } else if (d.district === "East") {
        d.x = right;
    }
}

function projectToWedge(d) {
    if (d.district === "North") {
        d.y = Math.min(d.y, cy - wedgePad);
        const maxDx = Math.max(0, cy - d.y - wedgePad);
        const dx = d.x - cx;
        if (Math.abs(dx) > maxDx) {
            d.x = cx + Math.sign(dx || -1) * maxDx;
        }
        return;
    }

    if (d.district === "South") {
        d.y = Math.max(d.y, cy + wedgePad);
        const maxDx = Math.max(0, d.y - cy - wedgePad);
        const dx = d.x - cx;
        if (Math.abs(dx) > maxDx) {
            d.x = cx + Math.sign(dx || 1) * maxDx;
        }
        return;
    }

    if (d.district === "East") {
        d.x = Math.max(d.x, cx + wedgePad);
        const maxDy = Math.max(0, d.x - cx - wedgePad);
        const dy = d.y - cy;
        if (Math.abs(dy) > maxDy) {
            d.y = cy + Math.sign(dy || 1) * maxDy;
        }
        return;
    }

    if (d.district === "West") {
        d.x = Math.min(d.x, cx - wedgePad);
        const maxDy = Math.max(0, cx - d.x - wedgePad);
        const dy = d.y - cy;
        if (Math.abs(dy) > maxDy) {
            d.y = cy + Math.sign(dy || -1) * maxDy;
        }
    }
}

function constrainToDistrict(d) {
    const x0 = d.x;
    const y0 = d.y;
    clampToDistrict(d);

    const dx = d.x - x0;
    const dy = d.y - y0;
    if (dx === 0 && dy === 0) {
        return;
    }

    const outgoing = d.vx * dx + d.vy * dy;
    if (outgoing < 0) {
        const length2 = dx * dx + dy * dy;
        d.vx -= (outgoing / length2) * dx;
        d.vy -= (outgoing / length2) * dy;
    }
}

function clampToDistrict(d) {
    if (d.district === "Central") {
        d.x = clampValue(
            d.x,
            centralBox.x + nodePad,
            centralBox.x + CENTRAL_SIZE - nodePad
        );
        d.y = clampValue(
            d.y,
            centralBox.y + nodePad,
            centralBox.y + CENTRAL_SIZE - nodePad
        );
        return;
    }

    clampToCanvas(d);
    pushOutOfCentralSquare(d);
    projectToWedge(d);
    pushOutOfCentralSquare(d);
    clampToCanvas(d);
}

function arrowThickness(strokeWidth) {
    return Math.max(ARROW_MIN_THICKNESS, strokeWidth * ARROW_THICKNESS_RATIO);
}

function arrowLength(strokeWidth) {
    return Math.max(ARROW_MIN_LENGTH, strokeWidth * ARROW_LENGTH_RATIO);
}

function appendArrowMarker(defs, id, color, strokeWidth) {
    const thickness = arrowThickness(strokeWidth);
    const length = arrowLength(strokeWidth);

    defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -4 8 8")
        .attr("refX", 7.2)
        .attr("refY", 0)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("markerWidth", length)
        .attr("markerHeight", thickness)
        .attr("orient", "auto")
        .attr("overflow", "visible")
        .append("path")
        .attr("d", "M0,-3.2L8,0L0,3.2Z")
        .attr("fill", color)
        .attr("fill-opacity", 1)
        .attr("stroke", "#080b12")
        .attr("stroke-width", 0.9)
        .attr("stroke-linejoin", "round");
}

function linkEndpoints(d, extraEndPad = 8) {
    const dx = d.target.x - d.source.x;
    const dy = d.target.y - d.source.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const endPad = NODE_EDGE + extraEndPad;

    return {
        x1: d.source.x + ux * NODE_EDGE,
        y1: d.source.y + uy * NODE_EDGE,
        x2: d.target.x - ux * endPad,
        y2: d.target.y - uy * endPad
    };
}

function eventClientPoint(event) {
    const src = event.sourceEvent ?? event;
    return {
        x: src.clientX,
        y: src.clientY
    };
}

function clampTooltipPosition(x, y) {
    return {
        x: Math.min(Math.max(x, 8), window.innerWidth - 220),
        y: Math.min(Math.max(y, 8), window.innerHeight - 90)
    };
}

function moveTooltip(event) {
    const point = eventClientPoint(event);
    const pos = clampTooltipPosition(point.x + 10, point.y + 10);
    d3.select("#tooltip")
        .style("left", `${pos.x}px`)
        .style("top", `${pos.y}px`);
}

function showTooltip(event, html) {
    d3.select("#tooltip")
        .style("opacity", 1)
        .html(html);
    moveTooltip(event);
}

function hideTooltip() {
    d3.select("#tooltip").style("opacity", 0);
}

function drawNodeLink(stations, routes) {
    const nodes = stations.map(d => ({ ...d }));
    const links = routes.map(d => ({ ...d }));

    nodes.forEach(d => {
        const start = initialPosition(d.district);
        d.x = start.x;
        d.y = start.y;
        clampToDistrict(d);
    });

    const passengerExtent = d3.extent(nodes, d => d.daily_passengers);
    const passengerColor = d3.scaleSequential()
        .domain(passengerExtent)
        .interpolator(
            d3.interpolateRgbBasis(["#4c8dff", "#f4e27a", "#ff4d6d"])
        );

    const routeColor = d3.scaleOrdinal()
        .domain(Object.keys(routeColors))
        .range(Object.values(routeColors));

    const linkWidthScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.travel_time_min))
        .range([1.4, 7]);

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");
    links.forEach((route, i) => {
        const stroke = linkWidthScale(route.travel_time_min);
        appendArrowMarker(
            defs,
            `arrow-${i}`,
            routeColors[route.route_type],
            stroke
        );
        appendArrowMarker(
            defs,
            `arrow-inactive-${i}`,
            inactiveLinkColor,
            stroke
        );
    });

    const districtLayer = svg.append("g").attr("class", "districts");

    districtLayer.selectAll("line.district-cross")
        .data([
            {
                x1: margin.left,
                y1: margin.top,
                x2: width - margin.right,
                y2: height - margin.bottom
            },
            {
                x1: width - margin.right,
                y1: margin.top,
                x2: margin.left,
                y2: height - margin.bottom
            }
        ])
        .join("line")
        .attr("class", "district-cross")
        .attr("x1", d => d.x1)
        .attr("y1", d => d.y1)
        .attr("x2", d => d.x2)
        .attr("y2", d => d.y2)
        .attr("stroke", "rgba(255, 255, 255, 0.22)")
        .attr("stroke-dasharray", "7,5")
        .attr("pointer-events", "none");

    districtLayer.append("rect")
        .attr("x", centralBox.x)
        .attr("y", centralBox.y)
        .attr("width", CENTRAL_SIZE)
        .attr("height", CENTRAL_SIZE)
        .attr("fill", "rgba(230, 195, 92, 0.07)")
        .attr("stroke", "rgba(230, 195, 92, 0.5)")
        .attr("stroke-dasharray", "6,4")
        .attr("pointer-events", "none");

    districtLayer.selectAll("text.district-label")
        .data([
            { name: "North", x: cx, y: margin.top + 18, anchor: "middle" },
            { name: "South", x: cx, y: height - margin.bottom - 6, anchor: "middle" },
            { name: "West", x: margin.left + 10, y: cy + 4, anchor: "start" },
            { name: "East", x: width - margin.right - 10, y: cy + 4, anchor: "end" },
            { name: "Central", x: cx, y: centralBox.y + 20, anchor: "middle" }
        ])
        .join("text")
        .attr("class", "district-label")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("text-anchor", d => d.anchor)
        .attr("pointer-events", "none")
        .text(d => d.name);

    const linkHit = svg.append("g")
        .attr("class", "link-hits")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "transparent")
        .attr("stroke-width", d => Math.max(12, linkWidthScale(d.travel_time_min) + 8))
        .style("cursor", "pointer");

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => routeColor(d.route_type))
        .attr("stroke-width", d => linkWidthScale(d.travel_time_min))
        .attr("stroke-opacity", linkOpacity)
        .attr("stroke-linecap", "butt")
        .attr("marker-end", (d, i) => `url(#arrow-${i})`);

    const symbolPath = d3.symbol().size(NODE_SIZE);

    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g.station")
        .data(nodes)
        .join("g")
        .attr("class", "station");

    node.append("circle")
        .attr("class", "station-hit")
        .attr("r", 16)
        .attr("fill", "none")
        .attr("pointer-events", "all");

    node.append("path")
        .attr("class", "station-shape")
        .attr("d", d => symbolPath.type(stationSymbol[d.station_type])())
        .attr("fill", d => passengerColor(d.daily_passengers));

    const label = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("class", "station-label")
        .attr("dx", 12)
        .attr("dy", 4)
        .text(d => d.id);

    const simulation = d3.forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(LINK_DISTANCE)
                .strength(0.35)
        )
        .force("charge", d3.forceManyBody().strength(-280))
        .force("collision", d3.forceCollide().radius(NODE_COLLIDE_RADIUS))
        .force(
            "x",
            d3.forceX(d => districtCenter(d.district).x).strength(0.07)
        )
        .force(
            "y",
            d3.forceY(d => districtCenter(d.district).y).strength(0.07)
        );

    function setLinkPosition(selection) {
        selection.each(function (d) {
            const stroke = linkWidthScale(d.travel_time_min);
            const pos = linkEndpoints(d, arrowLength(stroke) * 0.95);
            d3.select(this)
                .attr("x1", pos.x1)
                .attr("y1", pos.y1)
                .attr("x2", pos.x2)
                .attr("y2", pos.y2);
        });
    }

    function setNodePosition(d, x, y) {
        d.x = x;
        d.y = y;
        clampToDistrict(d);
        d.fx = d.x;
        d.fy = d.y;
    }

    function renderPositions() {
        nodes.forEach(d => {
            constrainToDistrict(d);
            if (d.fx != null) {
                d.fx = d.x;
                d.fy = d.y;
            }
        });
        setLinkPosition(link);
        setLinkPosition(linkHit);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
        label
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    }

    simulation.on("tick", renderPositions);

    function applyRouteFilter() {
        const selected = d3.select("#route-filter").property("value");
        const isActive = d => selected === "all" || d.route_type === selected;

        link
            .attr("stroke", d => (
                isActive(d) ? routeColor(d.route_type) : inactiveLinkColor
            ))
            .attr("stroke-opacity", d => (isActive(d) ? linkOpacity : 0.16))
            .attr("marker-end", (d, i) => (
                isActive(d)
                    ? `url(#arrow-${i})`
                    : `url(#arrow-inactive-${i})`
            ));
    }

    d3.select("#route-filter").on("change", applyRouteFilter);

    function isIncidentLink(route, station) {
        return route.source.id === station.id || route.target.id === station.id;
    }

    function neighborIds(station) {
        const ids = new Set([station.id]);
        links.forEach(route => {
            if (route.source.id === station.id) {
                ids.add(route.target.id);
            }
            if (route.target.id === station.id) {
                ids.add(route.source.id);
            }
        });
        return ids;
    }

    function clearHighlight() {
        node
            .classed("is-hovered", false)
            .classed("is-related", false)
            .classed("is-dimmed", false);
        link
            .classed("is-related", false)
            .classed("is-dimmed", false);
        label.classed("is-dimmed", false);
    }

    function highlightStation(station) {
        const ids = neighborIds(station);

        node
            .classed("is-hovered", d => d.id === station.id)
            .classed("is-related", d => ids.has(d.id) && d.id !== station.id)
            .classed("is-dimmed", d => !ids.has(d.id));

        link
            .classed("is-related", route => isIncidentLink(route, station))
            .classed("is-dimmed", route => !isIncidentLink(route, station));

        label.classed("is-dimmed", d => !ids.has(d.id));
    }

    function highlightRoute(route) {
        const ids = new Set([route.source.id, route.target.id]);

        node
            .classed("is-hovered", false)
            .classed("is-related", d => ids.has(d.id))
            .classed("is-dimmed", d => !ids.has(d.id));

        link
            .classed("is-related", d => d === route)
            .classed("is-dimmed", d => d !== route);

        label.classed("is-dimmed", d => !ids.has(d.id));
    }

    node.call(
        d3.drag()
            .container(svg.node())
            .on("start", (event, d) => {
                event.sourceEvent.preventDefault();
                event.sourceEvent.stopPropagation();
                node.filter(n => n.id === d.id).raise();
                if (!event.active) {
                    simulation.alphaTarget(0.2).restart();
                }
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                setNodePosition(d, event.x, event.y);
            })
            .on("end", (event, d) => {
                clampToDistrict(d);
                d.fx = d.x;
                d.fy = d.y;
                d.vx = 0;
                d.vy = 0;
                if (!event.active) {
                    simulation.alphaTarget(0);
                }
            })
    );

    node
        .on("mouseover.tooltip", (event, d) => {
            showTooltip(
                event,
                `<strong>${d.id}</strong><br>${d.station_name}<br>Daily passengers: ${d3.format(",")(d.daily_passengers)}`
            );
        })
        .on("mousemove.tooltip", moveTooltip)
        .on("mouseout.tooltip", hideTooltip)
        .on("mouseover.highlight", (event, d) => highlightStation(d))
        .on("mouseout.highlight", clearHighlight);

    linkHit
        .on("mouseover.tooltip", (event, d) => {
            showTooltip(
                event,
                `<strong>${d.source.station_name} → ${d.target.station_name}</strong><br>Route: ${d.route_type}<br>Travel time: ${d.travel_time_min} min`
            );
        })
        .on("mousemove.tooltip", moveTooltip)
        .on("mouseout.tooltip", hideTooltip)
        .on("mouseover.highlight", (event, d) => highlightRoute(d))
        .on("mouseout.highlight", clearHighlight);

    drawNodeLinkLegend(passengerExtent, passengerColor, routeColor, linkWidthScale);
}

function drawNodeLinkLegend(passengerExtent, passengerColor, routeColor, linkWidthScale) {
    const legend = d3.select("#legend");
    legend.selectAll("*").remove();

    const passengerBlock = legend.append("div").attr("class", "legend-block");
    passengerBlock.append("div")
        .attr("class", "legend-title")
        .text("Daily passengers");

    const legendWidth = 180;
    const legendHeight = 12;
    const passengerSvg = passengerBlock
        .append("svg")
        .attr("width", legendWidth + 8)
        .attr("height", 40);

    const gradientId = "passenger-color-gradient";
    const defs = passengerSvg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", gradientId);

    d3.range(0, 11).forEach(i => {
        const t = i / 10;
        const value = passengerExtent[0] + t * (passengerExtent[1] - passengerExtent[0]);
        gradient.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", passengerColor(value));
    });

    passengerSvg.append("rect")
        .attr("x", 4)
        .attr("y", 4)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("rx", 3)
        .attr("fill", `url(#${gradientId})`);

    passengerSvg.append("text")
        .attr("x", 4)
        .attr("y", 34)
        .attr("fill", "#8e99ad")
        .attr("font-size", 11)
        .text(d3.format(",")(passengerExtent[0]));

    passengerSvg.append("text")
        .attr("x", legendWidth + 4)
        .attr("y", 34)
        .attr("fill", "#8e99ad")
        .attr("font-size", 11)
        .attr("text-anchor", "end")
        .text(d3.format(",")(passengerExtent[1]));

    const typeBlock = legend.append("div").attr("class", "legend-block");
    typeBlock.append("div")
        .attr("class", "legend-title")
        .text("Station type");

    const typeSvg = typeBlock
        .append("svg")
        .attr("width", 160)
        .attr("height", 78);

    const typeItems = [
        { type: "Local", symbol: d3.symbolCircle, y: 14 },
        { type: "Transfer", symbol: d3.symbolSquare, y: 38 },
        { type: "Terminal", symbol: d3.symbolTriangle, y: 62 }
    ];
    const typeSymbol = d3.symbol().size(110);

    typeSvg.selectAll("path")
        .data(typeItems)
        .join("path")
        .attr("transform", d => `translate(12,${d.y})`)
        .attr("d", d => typeSymbol.type(d.symbol)())
        .attr("fill", "#f3f6ff")
        .attr("stroke", "rgba(243, 246, 255, 0.55)")
        .attr("stroke-width", 1.6);

    typeSvg.selectAll("text")
        .data(typeItems)
        .join("text")
        .attr("x", 28)
        .attr("y", d => d.y + 4)
        .attr("fill", "#f3f6ff")
        .attr("font-size", 13)
        .text(d => d.type);

    const routeBlock = legend.append("div").attr("class", "legend-block");
    routeBlock.append("div")
        .attr("class", "legend-title")
        .text("Route type");

    const routeItems = routeColor.domain();
    routeItems.forEach(type => {
        const row = routeBlock.append("div").attr("class", "legend-row");
        row.append("span")
            .style("display", "inline-block")
            .style("width", "28px")
            .style("height", "3px")
            .style("background", routeColor(type));
        row.append("span").text(type);
    });

    const timeBlock = legend.append("div").attr("class", "legend-block");
    timeBlock.append("div")
        .attr("class", "legend-title")
        .text("Travel time");

    const timeExtent = linkWidthScale.domain();
    [
        { label: `${timeExtent[0]} min`, value: timeExtent[0] },
        { label: `${timeExtent[1]} min`, value: timeExtent[1] }
    ].forEach(item => {
        const row = timeBlock.append("div").attr("class", "legend-row");
        row.append("span")
            .style("display", "inline-block")
            .style("width", "36px")
            .style("height", `${linkWidthScale(item.value)}px`)
            .style("background", "#c5cde0")
            .style("border-radius", "2px");
        row.append("span").text(item.label);
    });
}

function sortStationsForMatrix(stations) {
    return stations.slice().sort((a, b) => {
        const typeDiff =
            stationTypeOrder.indexOf(a.station_type) -
            stationTypeOrder.indexOf(b.station_type);

        if (typeDiff !== 0) {
            return typeDiff;
        }

        return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
}

function matrixTooltipHtml(cell, stationById) {
    const rowStation = stationById.get(cell.row);
    const colStation = stationById.get(cell.col);
    const formatCount = d3.format(",");
    const rowBlock = `
        <strong>Row ${rowStation.id}: ${rowStation.station_name}</strong><br>
        District: ${rowStation.district}<br>
        Station type: ${rowStation.station_type}<br>
        Daily passengers: ${formatCount(rowStation.daily_passengers)}
    `;
    const colBlock = `
        <strong>Column ${colStation.id}: ${colStation.station_name}</strong><br>
        District: ${colStation.district}<br>
        Station type: ${colStation.station_type}<br>
        Daily passengers: ${formatCount(colStation.daily_passengers)}
    `;

    if (!cell.route) {
        return `${rowBlock}<br><br>${colBlock}<br><br>No direct route between these stations.`;
    }

    return `${rowBlock}<br><br>${colBlock}<br><br>
        <strong>Direct route</strong><br>
        Direction: ${cell.route.source} → ${cell.route.target}<br>
        Route type: ${cell.route.route_type}<br>
        Travel time: ${cell.route.travel_time_min} min`;
}

function drawAdjacencyMatrix(stations, routes) {
    const ordered = sortStationsForMatrix(stations);
    const stationById = new Map(stations.map(d => [d.id, d]));
    const ids = ordered.map(d => d.id);

    const routeByPair = new Map();
    routes.forEach(route => {
        routeByPair.set(`${route.source}|${route.target}`, route);
        routeByPair.set(`${route.target}|${route.source}`, route);
    });

    const matrixData = [];
    ordered.forEach(rowStation => {
        ordered.forEach(colStation => {
            const route = routeByPair.get(`${rowStation.id}|${colStation.id}`) || null;
            matrixData.push({
                row: rowStation.id,
                col: colStation.id,
                route: rowStation.id === colStation.id ? null : route
            });
        });
    });

    const matrixSize = 560;
    const labelGap = 92;
    const typeGap = 22;
    const svgWidth = labelGap + matrixSize + 36;
    const svgHeight = labelGap + matrixSize + 28;

    const svg = d3.select("#matrix")
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

    const matrixX = d3.scaleBand()
        .domain(ids)
        .range([0, matrixSize])
        .padding(0.06);

    const matrixY = d3.scaleBand()
        .domain(ids)
        .range([0, matrixSize])
        .padding(0.06);

    const routeColor = d3.scaleOrdinal()
        .domain(Object.keys(routeColors))
        .range(Object.values(routeColors));

    const districtColor = d3.scaleOrdinal()
        .domain(Object.keys(districtColors))
        .range(Object.values(districtColors));

    const grid = svg.append("g")
        .attr("transform", `translate(${labelGap},${labelGap})`);

    const cells = grid.selectAll("rect")
        .data(matrixData)
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("x", d => matrixX(d.col))
        .attr("y", d => matrixY(d.row))
        .attr("width", matrixX.bandwidth())
        .attr("height", matrixY.bandwidth())
        .attr("rx", 1)
        .attr("fill", d => (d.route ? routeColor(d.route.route_type) : "#151a26"));

    const typeGroups = d3.groups(ordered, d => d.station_type);
    const dividerIds = [];
    typeGroups.slice(1).forEach(group => {
        dividerIds.push(group[1][0].id);
    });

    function dividerPosition(scale, id) {
        return scale(id) - (scale.step() - scale.bandwidth()) / 2;
    }

    grid.selectAll(".type-divider-v")
        .data(dividerIds)
        .join("line")
        .attr("class", "type-divider-v")
        .attr("x1", id => dividerPosition(matrixX, id))
        .attr("x2", id => dividerPosition(matrixX, id))
        .attr("y1", 0)
        .attr("y2", matrixSize)
        .attr("stroke", "rgba(243, 246, 255, 0.78)")
        .attr("stroke-width", 2.4)
        .attr("pointer-events", "none");

    grid.selectAll(".type-divider-h")
        .data(dividerIds)
        .join("line")
        .attr("class", "type-divider-h")
        .attr("x1", 0)
        .attr("x2", matrixSize)
        .attr("y1", id => dividerPosition(matrixY, id))
        .attr("y2", id => dividerPosition(matrixY, id))
        .attr("stroke", "rgba(243, 246, 255, 0.78)")
        .attr("stroke-width", 2.4)
        .attr("pointer-events", "none");

    const colLabels = grid.selectAll(".col-label")
        .data(ordered)
        .join("text")
        .attr("class", "col-label")
        .attr("x", d => matrixX(d.id) + matrixX.bandwidth() / 2)
        .attr("y", -10)
        .attr("text-anchor", "start")
        .attr("fill", d => districtColor(d.district))
        .attr("font-size", 9)
        .attr("transform", d => {
            const x = matrixX(d.id) + matrixX.bandwidth() / 2;
            return `rotate(-90,${x},${-10})`;
        })
        .text(d => d.id);

    const rowLabels = grid.selectAll(".row-label")
        .data(ordered)
        .join("text")
        .attr("class", "row-label")
        .attr("x", -8)
        .attr("y", d => matrixY(d.id) + matrixY.bandwidth() / 2 + 3)
        .attr("text-anchor", "end")
        .attr("fill", d => districtColor(d.district))
        .attr("font-size", 9)
        .text(d => d.id);

    typeGroups.forEach(([type, members]) => {
        const start = matrixX(members[0].id);
        const end = matrixX(members[members.length - 1].id) + matrixX.bandwidth();
        const mid = (start + end) / 2;

        grid.append("text")
            .attr("x", mid)
            .attr("y", -labelGap + typeGap)
            .attr("text-anchor", "middle")
            .attr("fill", "#8e99ad")
            .attr("font-size", 11)
            .attr("font-weight", 700)
            .attr("letter-spacing", "0.08em")
            .text(type);

        const yStart = matrixY(members[0].id);
        const yEnd = matrixY(members[members.length - 1].id) + matrixY.bandwidth();
        const yMid = (yStart + yEnd) / 2;

        grid.append("text")
            .attr("x", -labelGap + 14)
            .attr("y", yMid)
            .attr("text-anchor", "middle")
            .attr("fill", "#8e99ad")
            .attr("font-size", 11)
            .attr("font-weight", 700)
            .attr("letter-spacing", "0.08em")
            .attr("transform", `rotate(-90,${-labelGap + 14},${yMid})`)
            .text(type);
    });

    cells
        .on("mouseover.tooltip", (event, d) => {
            cells.classed("is-hovered", cell => cell === d);
            cells.classed(
                "is-cross",
                cell => cell.row === d.row || cell.col === d.col
            );
            rowLabels.classed("is-hovered", station => station.id === d.row);
            colLabels.classed("is-hovered", station => station.id === d.col);
            showTooltip(event, matrixTooltipHtml(d, stationById));
        })
        .on("mousemove.tooltip", moveTooltip)
        .on("mouseout.tooltip", () => {
            cells.classed("is-hovered", false);
            cells.classed("is-cross", false);
            rowLabels.classed("is-hovered", false);
            colLabels.classed("is-hovered", false);
            hideTooltip();
        });

    drawMatrixLegend(routeColor, districtColor);
}

function drawMatrixLegend(routeColor, districtColor) {
    const legend = d3.select("#matrix-legend");
    legend.selectAll("*").remove();

    const typeBlock = legend.append("div").attr("class", "legend-block");
    typeBlock.append("div")
        .attr("class", "legend-title")
        .text("Station type (order)");
    stationTypeOrder.forEach((type, index) => {
        const row = typeBlock.append("div").attr("class", "legend-row");
        row.append("span").text(`${index + 1}. ${type}`);
    });

    const districtBlock = legend.append("div").attr("class", "legend-block");
    districtBlock.append("div")
        .attr("class", "legend-title")
        .text("District (label color)");
    districtColor.domain().forEach(name => {
        const row = districtBlock.append("div").attr("class", "legend-row");
        row.append("span")
            .style("display", "inline-block")
            .style("width", "10px")
            .style("height", "10px")
            .style("border-radius", "50%")
            .style("background", districtColor(name));
        row.append("span").text(name);
    });

    const routeBlock = legend.append("div").attr("class", "legend-block");
    routeBlock.append("div")
        .attr("class", "legend-title")
        .text("Route type (cell color)");
    routeColor.domain().forEach(type => {
        const row = routeBlock.append("div").attr("class", "legend-row");
        row.append("span")
            .style("display", "inline-block")
            .style("width", "18px")
            .style("height", "12px")
            .style("background", routeColor(type));
        row.append("span").text(type);
    });
}
