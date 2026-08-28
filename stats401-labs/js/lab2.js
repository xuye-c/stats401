const width = 800;
const height = 600;

const margin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};
const orbitRadii = {
    low: 80,
    medium: 150,
    high: 220
};
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;
const centerX = width / 2;
const centerY = height / 2;
const crossLength = orbitRadii.high + 25;
const diagonal = crossLength / Math.sqrt(2);
const legendX = width - 150;
const legendY = height - 45;
const legendWidth = 110;
const legendHeight = 8;
const populationValues = [0.5, 1.5, 3.0];
const tooltip = d3.select("#tooltip");


//load data
d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    population: +d.population,
    temp_c: +d.temp_c,
    development_level: d.development_level,
    region: d.region
}))

//canvas
.then(data => {
    const regionAngleRanges = {
        North: [-3 * Math.PI / 4, -Math.PI / 4],
        East: [-Math.PI / 4, Math.PI / 4],
        South: [Math.PI / 4, 3 * Math.PI / 4],
        West: [3 * Math.PI / 4, 5 * Math.PI / 4]
    }
    const citiesByRegion = d3.group(data, d => d.region);
    const colorScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp_c))
        .range(["#0e4bae", "#da0c54"]);
    const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

    const gradient = svg.append("defs")
    .append("linearGradient")
    .attr("id", "temperature-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");
    gradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#0e4bae");
    gradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#da0c54");

    svg.append("line")
    .attr("x1", centerX - diagonal)
    .attr("y1", centerY - diagonal)
    .attr("x2", centerX + diagonal)
    .attr("y2", centerY + diagonal)
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 6")
    .attr("opacity", 0.35);
    svg.append("line")
    .attr("x1", centerX + diagonal)
    .attr("y1", centerY - diagonal)
    .attr("x2", centerX - diagonal)
    .attr("y2", centerY + diagonal)
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 6")
    .attr("opacity", 0.35);
    svg.append("text")
    .attr("x", centerX)
    .attr("y", centerY - crossLength - 12)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", "24px")
    .attr("font-weight", "600")
    .text("NORTH");
    svg.append("text")
    .attr("x", centerX)
    .attr("y", centerY + crossLength + 25)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", "24px")
    .attr("font-weight", "600")
    .text("SOUTH");
    svg.append("text")
    .attr("x", centerX + crossLength + 15)
    .attr("y", centerY + 4)
    .attr("text-anchor", "start")
    .attr("fill", "#94a3b8")
    .attr("font-size", "24px")
    .attr("font-weight", "600")
    .text("EAST");
    svg.append("text")
    .attr("x", centerX - crossLength - 15)
    .attr("y", centerY + 4)
    .attr("text-anchor", "end")
    .attr("fill", "#94a3b8")
    .attr("font-size", "24px")
    .attr("font-weight", "600")
    .text("WEST");
    svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("rx", 4)
    .attr("fill", "url(#temperature-gradient)");
    svg.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 10)
    .attr("fill", "#94a3b8")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .text("TEMPERATURE");
    const [minTemp, maxTemp] =d3.extent(data, d => d.temp_c);
    svg.append("text")
        .attr("x", legendX)
        .attr("y", legendY + 22)
        .attr("fill", "#94a3b8")
        .attr("font-size", "10px")
        .text(`${minTemp}°C`);

    svg.append("text")
        .attr("x", legendX + legendWidth)
        .attr("y", legendY + 22)
        .attr("text-anchor", "end")
        .attr("fill", "#94a3b8")
        .attr("font-size", "10px")
        .text(`${maxTemp}°C`);
    Object.entries(orbitRadii).forEach(([level, radius]) => {
        svg.append("circle")
            .attr("cx", centerX)
            .attr("cy", centerY)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("stroke", "gray")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4 4")
            .attr("opacity", 0.5);
       
    });
    function drawRegion(region) {
        const cities = citiesByRegion.get(region);
        const n = cities.length;
        const [startAngle, endAngle] =
            regionAngleRanges[region];
        cities.forEach((city, i) => {
            const angle =startAngle +(i + 0.5) * (endAngle - startAngle) / n;
            const radius =orbitRadii[city.development_level.toLowerCase()];
            const x =centerX + radius * Math.cos(angle);
            const y =centerY + radius * Math.sin(angle);
            const r = city.population * 10;

            svg.append("circle")
                .datum(city)
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", r)
                .attr("fill", colorScale(city.temp_c))
                .attr("stroke", "rgba(255,255,255,0.8)")
                .attr("stroke-width", 1)
                .attr("opacity", 0.9)
                .style("cursor", "pointer")
                .on("mouseenter", function(event, d) {
                    tooltip
                        .style("opacity", 1)
                        .style("left", `${event.pageX + 16}px`)
                        .style("top", `${event.pageY + 16}px`)
                        .html(`
                            <strong>${d.city}</strong><br>
                            Population: ${d.population.toFixed(1)}M<br>
                            Temperature: ${d.temp_c.toFixed(1)}°C<br>
                            Development: ${d.development_level}<br>
                            Region: ${d.region}
                        `);
                })
                .on("mousemove", function(event) {
                    tooltip
                        .style("left", `${event.pageX + 16}px`)
                        .style("top", `${event.pageY + 16}px`);
                })
                .on("mouseleave", function() {
                    tooltip.style("opacity", 0);
                });
        });
    }

    Object.keys(regionAngleRanges).forEach(drawRegion);
    Object.entries(orbitRadii).forEach(([level, radius]) => {

        const labelX = centerX + 260;
        const labelY = centerY - radius;

        svg.append("line")
            .attr("x1", centerX + radius * 0.7)
            .attr("y1", centerY - radius * 0.7)
            .attr("x2", labelX - 10)
            .attr("y2", labelY)
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1)
            .attr("opacity", 0.5);

        svg.append("text")
            .attr("x", labelX)
            .attr("y", labelY + 4)
            .attr("fill", "#94a3b8")
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .text(level.toUpperCase());

    }); 
    // Population legend
    const populationValues = [0.5, 1.5, 3.0];

    const popLegendX = 100;
    const popLegendY = height - 25;

    const populationRadius = population => population * 10;

    // Title
    svg.append("text")
        .attr("x", popLegendX-35)
        .attr("y",  popLegendY+15)
        .attr("fill", "#94a3b8")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .text("POPULATION");

    // Circles
    populationValues.forEach(population => {

        const r = populationRadius(population);

        svg.append("circle")
            .attr("cx", popLegendX)
            .attr("cy", popLegendY - r)
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1)
            .attr("opacity", 0.7);

        // Population label
        svg.append("text")
            .attr("x", popLegendX + r )
            .attr("y", popLegendY - r)
            .attr("fill", "#94a3b8")
            .attr("font-size", "10px")
            .attr("dominant-baseline", "middle")
            .text(population);

    });
        
    })
.catch(error => {
    console.error("Failed to load student data for Lab 2:", error);
});
