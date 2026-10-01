// ============================================================
// Lab 9 — Geospatial Visualization with D3
// ============================================================


// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

const GDP_FILE =
    "../data/lab9_gdp_2025_top50.csv";

// IMPORTANT:
// Change this path if your GeoJSON file has a different name.
const GEOJSON_FILE =
    "../data/world.geojson";

const width = 1100;
const height = 620;
const ISO3_OVERRIDES = {
    France: "FRA",
    Norway: "NOR"
};


// ------------------------------------------------------------
// Global state
// ------------------------------------------------------------

let geoData;
let gdpData;

let valueByISO = new Map();

let choroplethCountries;
let cartogramCountries;
let hoveredISO = null;
let selectedISO = null;


// ------------------------------------------------------------
// Load data
// ------------------------------------------------------------

Promise.all([
    d3.json(GEOJSON_FILE),

    d3.csv(
        GDP_FILE,
        d => ({
            iso3: d.iso3,
            country: d.country,
            gdp: +d.gdp_2025_billion_usd,
            rank: +d.rank
        })
    )
])
.then(([geo, gdp]) => {

    geoData = geo;
    gdpData = gdp;

    // --------------------------------------------------------
    // Create GDP lookup
    // --------------------------------------------------------

    valueByISO = new Map(
        gdpData.map(d => [
            d.iso3,
            d
        ])
    );


    // --------------------------------------------------------
    // Attach GDP information to GeoJSON
    // --------------------------------------------------------

    geoData.features.forEach(feature => {

        const rawGeoISO =
            feature.properties["ISO3166-1-Alpha-3"] ||
            feature.properties.iso_a3 ||
            feature.properties.ISO_A3 ||
            feature.properties.iso3 ||
            feature.properties.ADM0_A3;

        const geoISO = rawGeoISO === "-99"
            ? ISO3_OVERRIDES[feature.properties.name]
            : rawGeoISO;

        const data = valueByISO.get(geoISO);

        const iso =
            data ? data.iso3 : geoISO;

        feature.properties.iso3 = iso;

        feature.properties.gdp =
            data ? data.gdp : null;

        feature.properties.rank =
            data ? data.rank : null;

        feature.properties.gdpCountry =
            data ? data.country : null;
    });


    // --------------------------------------------------------
    // Draw
    // --------------------------------------------------------

    drawChoropleth();
    drawCartogram();
    drawLegend();

    const matchedCount = geoData.features.filter(
        feature => feature.properties.gdp != null
    ).length;

    if (matchedCount !== gdpData.length) {
        console.warn(
            `Matched ${matchedCount} of ${gdpData.length} GDP records by ISO-3.`
        );
    }

})
.catch(error => {

    console.error("Failed to load Lab 9 data:", error);

    document.body.insertAdjacentHTML(
        "beforeend",
        `
        <div style="
            position:fixed;
            bottom:20px;
            left:20px;
            right:20px;
            padding:15px;
            background:#fee;
            color:#900;
            border:1px solid #d88;
            border-radius:8px;
            z-index:9999;
        ">
            Failed to load Lab 9 data.
            Check the GeoJSON path and browser console.
        </div>
        `
    );
});


// ============================================================
// CHOROPLETH
// ============================================================

function drawChoropleth() {

    const container =
        d3.select("#choropleth-container");

    const svg =
        container
            .append("svg")
            .attr("class", "map-svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");


    // --------------------------------------------------------
    // Projection
    // --------------------------------------------------------

    const projection =
        d3.geoNaturalEarth1()
            .fitSize(
                [width, height],
                geoData
            );


    // --------------------------------------------------------
    // Path generator
    // --------------------------------------------------------

    const path =
        d3.geoPath()
            .projection(projection);


    // --------------------------------------------------------
    // Map group
    // --------------------------------------------------------

    const mapGroup =
        svg.append("g")
            .attr("class", "map-group");


    // --------------------------------------------------------
    // Color scale
    // --------------------------------------------------------

    const maxGDP =
        d3.max(
            gdpData,
            d => d.gdp
        );


    const colorScale =
        d3.scaleSequentialLog(
            d3.interpolateRgb("#293449", "#aeb8ff")
        )
        .domain([
            d3.min(gdpData, d => d.gdp),
            maxGDP
        ]);


    // --------------------------------------------------------
    // Draw countries
    // --------------------------------------------------------

    choroplethCountries =
        mapGroup
            .selectAll(".country")
            .data(geoData.features)
            .join("path")
            .attr("class", "country")
            .attr("d", path)
            .attr(
                "fill",
                d => {

                    if (d.properties.gdp == null) {
                        return "#343b48";
                    }

                    return colorScale(
                        d.properties.gdp
                    );
                }
            );


    // --------------------------------------------------------
    // Tooltip
    // --------------------------------------------------------

    addTooltip(
        choroplethCountries
    );


    // --------------------------------------------------------
    // Highlight
    // --------------------------------------------------------

    addHighlight(
        choroplethCountries
    );


    // --------------------------------------------------------
    // Zoom
    // --------------------------------------------------------

    const zoom =
        d3.zoom()
            .scaleExtent([1, 8])
            .on(
                "zoom",
                event => {

                    mapGroup.attr(
                        "transform",
                        event.transform
                    );
                }
            );

    svg.call(zoom);


    // --------------------------------------------------------
    // Reset button
    // --------------------------------------------------------

    d3.select("#reset-choropleth")
        .on("click", () => {

            svg.transition()
                .duration(500)
                .call(
                    zoom.transform,
                    d3.zoomIdentity
                );

        });
}


// ============================================================
// CARTOGRAM
// ============================================================

function drawCartogram() {

    const container = d3.select("#cartogram-container");
    const svg = container
        .append("svg")
        .attr("class", "map-svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const projection = d3.geoNaturalEarth1()
        .fitExtent([[90, 90], [width - 90, height - 80]], geoData);
    const path = d3.geoPath().projection(projection);
    const mapGroup = svg.append("g");

    mapGroup
        .selectAll(".cartogram-land")
        .data(geoData.features)
        .join("path")
        .attr("class", "cartogram-land")
        .attr("d", path);

    const features = geoData.features.filter(
        feature => feature.properties.gdp != null
    );
    const maxGDP = d3.max(gdpData, d => d.gdp);
    const areaPerBillion = width * height * 0.075 / maxGDP;
    const nodes = features.map(feature => {
        const centroid = path.centroid(feature);
        const targetArea = feature.properties.gdp * areaPerBillion;

        return {
            feature,
            centroid,
            radius: Math.sqrt(targetArea / Math.PI),
            x: centroid[0],
            y: centroid[1]
        };
    });

    const simulation = d3.forceSimulation(nodes)
        .randomSource(d3.randomLcg(0.42))
        .force("x", d3.forceX(d => d.centroid[0]).strength(0.2))
        .force("y", d3.forceY(d => d.centroid[1]).strength(0.2))
        .force(
            "collide",
            d3.forceCollide(d => d.radius + 2)
                .strength(0.9)
                .iterations(4)
        )
        .stop();

    for (let tick = 0; tick < 400; tick += 1) {
        simulation.tick();
    }

    cartogramCountries = mapGroup
        .selectAll(".cartogram-country")
        .data(nodes)
        .join("circle")
        .attr("class", "country cartogram-country")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.radius)
        .attr("fill", "#899cff")
        .attr("stroke", "#c9d1ff")
        .attr("stroke-width", 1.1)
        .datum(d => d.feature);

    mapGroup
        .selectAll(".cartogram-label")
        .data(nodes)
        .join("text")
        .attr("class", "cartogram-label")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("font-size", d => Math.min(15, Math.max(8, d.radius * 0.36)))
        .text(d => d.feature.properties.iso3);

    addTooltip(cartogramCountries);
    addHighlight(cartogramCountries);
}


// ============================================================
// TOOLTIP
// ============================================================

function addTooltip(selection) {

    const tooltip =
        d3.select("#tooltip");


    selection
        .on(
            "mousemove.tooltip",
            function(event, d) {

                const name =
                    d.properties.gdpCountry ||
                    d.properties.name ||
                    d.properties.NAME ||
                    "Unknown";


                const gdp =
                    d.properties.gdp;


                tooltip
                    .style(
                        "opacity",
                        1
                    )
                    .style(
                        "left",
                        `${event.clientX + 15}px`
                    )
                    .style(
                        "top",
                        `${event.clientY + 15}px`
                    )
                    .html(
                        `
                        <div class="country-name">
                            ${name}
                        </div>

                        <div class="gdp">
                            GDP:
                            ${
                                gdp == null
                                ? "No data"
                                : `$${d3.format(",.1f")(gdp)}B`
                            }
                        </div>

                        ${
                            d.properties.rank
                            ? `
                            <div class="gdp">
                                Rank:
                                ${d.properties.rank}
                            </div>
                            `
                            : ""
                        }
                        `
                    );
            }
        )
        .on(
            "mouseleave.tooltip",
            function() {

                tooltip
                    .style(
                        "opacity",
                        0
                    );
            }
        );
}


// ============================================================
// LINKED HIGHLIGHTING
// ============================================================

function addHighlight(selection) {

    selection
        .on(
            "mouseenter.highlight",
            function(event, d) {
                hoveredISO = d.properties.iso3;
                renderHighlight();
            }
        )
        .on(
            "mouseleave.highlight",
            function() {
                hoveredISO = null;
                renderHighlight();
            }
        )
        .on(
            "click.highlight",
            function(event, d) {
                event.stopPropagation();
                selectedISO = selectedISO === d.properties.iso3
                    ? null
                    : d.properties.iso3;
                renderHighlight();
            }
        );
}


function renderHighlight() {

    const activeISO = hoveredISO || selectedISO;

    [
        choroplethCountries,
        cartogramCountries
    ]
    .forEach(selection => {

        if (!selection) {
            return;
        }

        selection
            .attr(
                "opacity",
                d =>
                    !activeISO || d.properties.iso3 === activeISO
                    ? 1
                    : 0.35
            )
            .attr(
                "stroke",
                d =>
                    d.properties.iso3 === activeISO
                    ? "#ffffff"
                    : "#525a70"
            )
            .attr(
                "stroke-width",
                d =>
                    d.properties.iso3 === activeISO
                    ? 2
                    : 0.65
            );
    });

    d3.selectAll(".cartogram-label")
        .attr("opacity", d =>
            !activeISO || d.feature.properties.iso3 === activeISO
                ? 1
                : 0.35
        );
}


// ============================================================
// LEGEND
// ============================================================

function drawLegend() {

    const container =
        d3.select("#choropleth-legend");


    const legendWidth = 300;
    const legendHeight = 14;


    const maxGDP =
        d3.max(
            gdpData,
            d => d.gdp
        );


    const minGDP =
        d3.min(
            gdpData,
            d => d.gdp
        );


    const scale =
        d3.scaleSequentialLog(
            d3.interpolateRgb("#293449", "#aeb8ff")
        )
        .domain([
            minGDP,
            maxGDP
        ]);


    const svg =
        container
            .append("svg")
            .attr(
                "width",
                legendWidth + 30
            )
            .attr(
                "height",
                60
            );


    const defs =
        svg.append("defs");


    const gradient =
        defs.append("linearGradient")
            .attr(
                "id",
                "gdp-gradient"
            )
            .attr(
                "x1",
                "0%"
            )
            .attr(
                "x2",
                "100%"
            );


    const stops =
        d3.range(
            0,
            1.01,
            0.1
        );


    gradient
        .selectAll("stop")
        .data(stops)
        .join("stop")
        .attr(
            "offset",
            d => `${d * 100}%`
        )
        .attr(
            "stop-color",
            d =>
                scale(
                    minGDP *
                    Math.pow(
                        maxGDP / minGDP,
                        d
                    )
                )
        );


    svg.append("text")
        .attr(
            "class",
            "legend-title"
        )
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            12
        )
        .text(
            "2025 Nominal GDP (billion USD)"
        );


    svg.append("rect")
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            20
        )
        .attr(
            "width",
            legendWidth
        )
        .attr(
            "height",
            legendHeight
        )
        .attr(
            "fill",
            "url(#gdp-gradient)"
        );


    svg.append("text")
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            50
        )
        .attr(
            "font-size",
            11
        )
        .attr(
            "fill",
            "#666"
        )
        .text(
            `$${d3.format(",.0f")(minGDP)}B`
        );


    svg.append("text")
        .attr(
            "x",
            legendWidth
        )
        .attr(
            "y",
            50
        )
        .attr(
            "text-anchor",
            "end"
        )
        .attr(
            "font-size",
            11
        )
        .attr(
            "fill",
            "#666"
        )
        .text(
            `$${d3.format(",.0f")(maxGDP)}B`
        );

    container
        .append("span")
        .attr("class", "legend-missing")
        .html('<span aria-hidden="true"></span> No data in top 50');
}