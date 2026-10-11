const DATA_URL = "../data/lab6_assignment_gdp.json";

const width = 960;
const height = 560;

const statusColors = {
    Increase: "#4fd2a5",
    Unchanged: "#8ea0c4",
    Decrease: "#e07a6b"
};

const STATUS_WORDS = {
    increase: "Increase",
    growing: "Increase",
    growth: "Increase",
    decrease: "Decrease",
    declining: "Decrease",
    shrinking: "Decrease",
    unchanged: "Unchanged",
    stable: "Unchanged",
    flat: "Unchanged"
};

const ALIASES = {
    usa: "united states",
    us: "united states",
    "united states of america": "united states",
    uk: "united kingdom",
    britain: "united kingdom",
    "great britain": "united kingdom",
    england: "united kingdom",
    korea: "south korea",
    "s korea": "south korea",
    nz: "new zealand",
    holland: "netherlands"
};

const tooltip = d3.select("#tooltip");

function ancestorAtDepth(node, depth) {
    let current = node;
    while (current && current.depth > depth) {
        current = current.parent;
    }
    return current;
}

function contains(ancestor, node) {
    let current = node;
    while (current) {
        if (current === ancestor) {
            return true;
        }
        current = current.parent;
    }
    return false;
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

function normalize(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function unrecognized(command) {
    const heard = command ? `: "${String(command).trim()}"` : "";
    return `Command not recognized${heard}. Try "Show Asia", "Highlight Japan", "Show increase", or "Reset".`;
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

    function paddingFor(node, maxPad, ratio) {
        const room = Math.min(node.x1 - node.x0, node.y1 - node.y0);
        return Math.min(maxPad, Math.max(0, room * ratio));
    }

    d3.treemap()
        .tile(tile)
        .size([width, height])
        .paddingInner(node => paddingFor(node, 2, 0.04))
        .paddingOuter(node => paddingFor(node, 4, 0.06))
        .paddingTop(node => paddingFor(node, 22, 0.18))
        (root);

    let focus = root;
    let pinned = null;
    let statusFilter = null;
    let onViewChange = () => {};

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([0, height]);

    function setDomain(node) {
        x.domain([node.x0, node.x1]);
        y.domain([node.y0, node.y1]);
    }

    setDomain(root);

    const host = d3.select(selector);
    const nav = host.append("div").attr("class", "treemap-nav");
    const clipId = "treemap-zoom-clip";

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

    function showCard(node) {
        const card = d3.select("#selection-text");
        card.html("");

        if (!node) {
            card.text('Hover a country, or say "Highlight Japan".');
            return;
        }

        const continent = ancestorAtDepth(node, 1).data.name;
        const area = ancestorAtDepth(node, 2).data.name;
        card.append("strong").text(node.data.name);
        card.append("span").text(
            ` · ${area}, ${continent} · GDP ${formatGdp(node.data.gdp)} billion USD · ${node.data.status}`
        );
    }

    function setPinned(node) {
        pinned = node;
        leaves.classed("is-selected", d => d === node);
        showCard(node);
    }

    function applyFilter() {
        leaves.classed(
            "is-dimmed",
            d => Boolean(statusFilter) && d.data.status !== statusFilter
        );
        d3.select("#filter-note").text(
            statusFilter
                ? `Filter: ${statusFilter} only. Other economies are dimmed.`
                : ""
        );
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

    function updateLabels(duration) {
        parentLayer.selectAll(".parent-label, .area-label")
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
        if (!node) {
            return;
        }

        const changed = node !== focus;
        focus = node;
        setDomain(focus);

        if (pinned && !contains(focus, pinned)) {
            setPinned(null);
        }

        updateBreadcrumb();
        applyFilter();

        if (!changed) {
            return;
        }

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

        updateLabels(duration);
        onViewChange();
    }

    function resolveNode(query) {
        const original = String(query || "").trim();
        let q = normalize(original);
        if (!q || q.length < 2) {
            return { error: true, message: unrecognized(original) };
        }

        q = ALIASES[q] || q;
        const nodes = root.descendants().filter(d => d.depth > 0);
        const exact = nodes.filter(d => normalize(d.data.name) === q);
        if (exact.length === 1) {
            return { node: exact[0] };
        }

        const partial = nodes.filter(d => {
            const key = normalize(d.data.name);
            return key.includes(q) || q.includes(key);
        });

        if (partial.length === 1) {
            return { node: partial[0] };
        }

        if (partial.length > 1) {
            partial.sort((a, b) => {
                const da = Math.abs(normalize(a.data.name).length - q.length);
                const db = Math.abs(normalize(b.data.name).length - q.length);
                return da - db || b.depth - a.depth;
            });

            const bestGap = Math.abs(normalize(partial[0].data.name).length - q.length);
            const secondGap = Math.abs(normalize(partial[1].data.name).length - q.length);
            if (bestGap + 1 < secondGap) {
                return { node: partial[0] };
            }

            const names = partial.slice(0, 5).map(d => d.data.name).join(", ");
            return {
                error: true,
                message: `Several matches for "${original}": ${names}. Say a fuller name.`
            };
        }

        return { error: true, message: unrecognized(original) };
    }

    function sizeIfFocused(target, node) {
        const spanX = Math.max(target.x1 - target.x0, 1e-6);
        const spanY = Math.max(target.y1 - target.y0, 1e-6);
        return {
            w: (node.x1 - node.x0) / spanX * width,
            h: (node.y1 - node.y0) / spanY * height
        };
    }

    function ensureCountryVisible(node) {
        if (contains(focus, node)) {
            const here = sizeIfFocused(focus, node);
            if (here.w >= 90 && here.h >= 36) {
                return;
            }
        }

        const chain = pathToRoot(node).filter(candidate => candidate !== node);
        let chosen = node.parent;
        for (const candidate of chain) {
            const size = sizeIfFocused(candidate, node);
            if (size.w >= 90 && size.h >= 36) {
                chosen = candidate;
                break;
            }
        }

        if (focus !== chosen) {
            zoomTo(chosen);
        }
    }

    leaves
        .on("click", function (event, d) {
            event.stopPropagation();
            hideTooltip();
            zoomTo(nextZoomTarget(d, focus));
        })
        .on("mouseover", function (event, d) {
            d3.select(this).classed("is-hovered", true);
            showCard(d);
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
            showCard(pinned);
        });

    updateBreadcrumb();
    updateLabels(0);
    applyFilter();
    showCard(null);

    return {
        currentFocusName() {
            return focus.data.name;
        },
        currentStatus() {
            return statusFilter;
        },
        names() {
            return root.descendants()
                .filter(d => d.depth > 0)
                .map(d => d.data.name);
        },
        regions() {
            return root.children.map(d => d.data.name);
        },
        zoomToName(query) {
            const match = resolveNode(query);
            if (match.error) {
                return match;
            }

            zoomTo(match.node);
            if (match.node.height === 0) {
                setPinned(match.node);
            }

            const verb = match.node.height === 0 ? "Zoomed to" : "Showing";
            return {
                ok: true,
                message: `${verb} ${match.node.data.name}.`
            };
        },
        highlightName(query) {
            const match = resolveNode(query);
            if (match.error) {
                return match;
            }

            if (match.node.height !== 0) {
                return {
                    error: true,
                    message: `"${match.node.data.name}" is a region. Say "Show ${match.node.data.name}" to zoom there.`
                };
            }

            ensureCountryVisible(match.node);
            setPinned(match.node);

            const area = ancestorAtDepth(match.node, 2).data.name;
            const continent = ancestorAtDepth(match.node, 1).data.name;
            return {
                ok: true,
                message: `Highlighted ${match.node.data.name} (${area}, ${continent}): ${formatGdp(match.node.data.gdp)} billion USD, ${match.node.data.status}.`
            };
        },
        filterStatus(status) {
            statusFilter = status;
            applyFilter();
        },
        zoomOut() {
            if (!focus.parent) {
                return "Already at the world view.";
            }

            const target = focus.parent;
            zoomTo(target);
            return `Zoomed out to ${target.data.name}.`;
        },
        reset() {
            statusFilter = null;
            applyFilter();
            setPinned(null);
            zoomTo(root);
        },
        onViewChange(listener) {
            onViewChange = listener;
        }
    };
}

function setupInteraction(api) {
    const statusEl = d3.select("#voice-status");
    const heardEl = d3.select("#voice-heard");
    const actionEl = d3.select("#voice-action");
    const voiceButton = d3.select("#voice-button");
    const stopButton = d3.select("#voice-stop");

    function setStatus(text) {
        statusEl.text(text);
    }

    function setHeard(text) {
        heardEl.text(text || "—");
    }

    function setAction(text, isError) {
        actionEl.classed("is-error", Boolean(isError)).text(text);
    }

    function syncButtons() {
        const focusName = api.currentFocusName();
        const status = api.currentStatus();

        d3.selectAll("#region-buttons button")
            .classed("is-active", function () {
                return this.dataset.region === focusName;
            });

        d3.selectAll("#status-buttons button")
            .classed("is-active", function () {
                if (this.dataset.status === "all") {
                    return !status;
                }
                return this.dataset.status === status;
            });
    }

    function handleVoiceCommand(raw) {
        const heard = String(raw || "").toLowerCase().trim();
        const command = normalize(heard);
        setHeard(heard || "—");

        if (!command) {
            setAction(unrecognized(""), true);
            return;
        }

        if (/^(reset|clear|start over)$/.test(command)) {
            api.reset();
            syncButtons();
            setAction("Reset the treemap to the world view.");
            return;
        }

        if (/^(zoom out|go back|back|out)$/.test(command)) {
            setAction(api.zoomOut());
            syncButtons();
            return;
        }

        if (/^(clear filter|show all|all)$/.test(command)) {
            api.filterStatus(null);
            syncButtons();
            setAction("Cleared the status filter.");
            return;
        }

        const statusMatch = command.match(
            /^(?:show|filter|only|display)?\s*(increase|growing|growth|decrease|declining|shrinking|unchanged|stable|flat)$/
        );
        if (statusMatch) {
            const label = STATUS_WORDS[statusMatch[1]];
            api.filterStatus(label);
            syncButtons();
            setAction(`Showing only ${label} economies.`);
            return;
        }

        const highlightMatch = command.match(/^(?:highlight|select|focus on|focus)\s+(.+)$/);
        if (highlightMatch) {
            const result = api.highlightName(highlightMatch[1]);
            setAction(result.message, result.error);
            syncButtons();
            return;
        }

        const showMatch = command.match(/^(?:show me|show|zoom to|zoom into|zoom|go to|open|view|display)\s+(.+)$/);
        if (showMatch) {
            const target = showMatch[1].replace(/^(me|the|a|an)\s+/, "");
            const result = api.zoomToName(target);
            setAction(result.message, result.error);
            syncButtons();
            return;
        }

        const result = api.zoomToName(command);
        setAction(result.message, result.error);
        syncButtons();
    }

    api.regions().forEach(name => {
        d3.select("#region-buttons")
            .append("button")
            .attr("type", "button")
            .attr("data-region", name)
            .text(name)
            .on("click", () => {
                const result = api.zoomToName(name);
                setHeard("—");
                setAction(result.message, result.error);
                syncButtons();
            });
    });

    d3.selectAll("#status-buttons button").on("click", function () {
        const value = this.dataset.status;
        if (value === "all") {
            api.filterStatus(null);
            setAction("Cleared the status filter.");
        } else {
            api.filterStatus(value);
            setAction(`Showing only ${value} economies.`);
        }
        setHeard("—");
        syncButtons();
    });

    d3.select("#zoom-out").on("click", () => {
        setHeard("—");
        setAction(api.zoomOut());
        syncButtons();
    });

    d3.select("#reset-view").on("click", () => {
        api.reset();
        setHeard("—");
        setAction("Reset the treemap to the world view.");
        syncButtons();
    });

    d3.select("#command-form").on("submit", event => {
        event.preventDefault();
        const input = d3.select("#command-input");
        handleVoiceCommand(input.property("value"));
        input.property("value", "");
    });

    d3.selectAll("[data-command]").on("click", function () {
        handleVoiceCommand(this.dataset.command);
    });

    const names = api.names();
    const list = d3.select("#name-list");
    names.forEach(name => {
        list.append("option").attr("value", name);
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceButton.property("disabled", true);
        setStatus("Speech recognition is not supported in this browser.");
        setAction('Use the buttons, or type "Show Asia".');
        syncButtons();
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    const silenceMs = 2000;
    let listening = false;
    let wantListening = false;
    let silenceTimer = null;
    let latestTranscript = "";
    let carriedTranscript = "";

    function setListening(active) {
        listening = active;
        voiceButton
            .classed("is-listening", active)
            .property("disabled", active)
            .text(active ? "Listening..." : "Start Voice Control");
        stopButton.property("disabled", !active);
    }

    function transcriptFrom(event) {
        let text = "";
        for (let i = 0; i < event.results.length; i += 1) {
            text += `${event.results[i][0].transcript} `;
        }
        return text.trim();
    }

    function scheduleCommit() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            finishListening();
        }, silenceMs);
    }

    function finishListening() {
        if (!wantListening) {
            return;
        }

        const transcript = latestTranscript;
        wantListening = false;
        clearTimeout(silenceTimer);
        setListening(false);
        setStatus("Voice control inactive");

        try {
            recognition.stop();
        } catch (error) {
            // The browser may already have closed this session.
        }

        if (!transcript) {
            setHeard("—");
            setAction('No speech detected. Try "Show Asia", "Highlight Japan", or "Reset".', true);
            return;
        }

        handleVoiceCommand(transcript);
    }

    recognition.onstart = () => {
        setListening(true);
        setStatus("Listening... pause for two seconds when you are done.");
    };

    recognition.onresult = event => {
        if (!wantListening) {
            return;
        }

        const sessionText = transcriptFrom(event);
        latestTranscript = `${carriedTranscript} ${sessionText}`.trim();
        setHeard(latestTranscript);
        setAction("Still listening.");
        scheduleCommit();
    };

    recognition.onerror = event => {
        if (event.error === "aborted" || event.error === "no-speech") {
            return;
        }

        wantListening = false;
        clearTimeout(silenceTimer);
        setListening(false);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setStatus("Microphone permission was denied.");
            setAction("Use the buttons below, or type a command. The chart does not need the microphone.", true);
            return;
        }

        setStatus("Voice control inactive");
        setAction("Speech recognition failed. Use the buttons or type a command.", true);
    };

    recognition.onend = () => {
        if (!wantListening) {
            setListening(false);
            if (statusEl.text().startsWith("Listening")) {
                setStatus("Voice control inactive");
            }
            return;
        }

        carriedTranscript = latestTranscript;
        window.setTimeout(() => {
            if (!wantListening) {
                return;
            }
            try {
                recognition.start();
            } catch (error) {
                finishListening();
            }
        }, 150);
    };

    voiceButton.on("click", () => {
        if (listening || wantListening) {
            return;
        }

        wantListening = true;
        latestTranscript = "";
        carriedTranscript = "";
        setHeard("—");
        setAction("—");
        setStatus("Listening... pause for two seconds when you are done.");

        try {
            recognition.start();
        } catch (error) {
            wantListening = false;
            setAction("Could not start the microphone. Try the buttons or the command box.", true);
        }
    });

    stopButton.on("click", () => {
        finishListening();
    });

    api.onViewChange(syncButtons);
    syncButtons();
}

d3.json(DATA_URL).then(data => {
    drawLegend("#legend");
    const api = drawTreemap("#treemap", data, d3.treemapSquarify);
    setupInteraction(api);
}).catch(error => {
    console.error(error);
    d3.select("#treemap").append("p").text("Could not load the GDP hierarchy.");
    d3.select("#voice-status").text("Visualization data failed to load.");
});
