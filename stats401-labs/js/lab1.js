document.addEventListener("DOMContentLoaded", () => {

    const binsConfig = [
        { label: "<70",  min: 0, max: 70 },
        { label: "70-80", min: 71, max: 80 },
        { label: "80-90", min: 81, max: 90 },
        { label: ">90", min: 91, max: 100 }
    ];

    const margin = { top: 30, right: 20, bottom: 40, left: 40 };
    const svgWidth = 600;
    const svgHeight = 400;
    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;
    const svg = d3.select("#chart");
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const tooltip = d3.select("#tooltip");

    d3.csv("../data/students.csv").then(rawData => {
        const data = rawData.map(d => ({
            name: d.name,
            score: Number(d.score)
        }));

        const binCounts = binsConfig.map(bin => {
            const studentsInBin = data.filter(d => d.score >= bin.min && d.score < bin.max);
            return {
                label: bin.label,
                count: studentsInBin.length,
                students: studentsInBin
            };
        });

        const xScale = d3.scaleBand()
            .domain(binCounts.map(d => d.label))
            .range([0, chartW])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(binCounts, d => d.count) || 0])
            .range([chartH, 0]);

        g.selectAll(".bar")
            .data(binCounts)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => xScale(d.label))
            .attr("y", d => yScale(d.count))
            .attr("width", xScale.bandwidth())
            .attr("height", d => chartH - yScale(d.count))
            .on("mouseover", function(event, d) {
                tooltip
                    .style("opacity", 1)
                    .html(`interval: ${d.label}<br>students: ${d.count}`);
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY - 12) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            })
            .on("click", function(event, d) {
                const studentsInBin = d.students || [];
                const nameList = studentsInBin.map(s => s.name).join("\n");

                if (studentsInBin.length === 0) {
                    alert(`interval ${d.label}: None`);
                } else {
                    alert(`interval ${d.label} (Total: ${d.count} students):\n${nameList}`);
                }
            });

        g.append("g")
            .attr("transform", `translate(0, ${chartH})`)
            .call(d3.axisBottom(xScale));

        g.append("g")
            .call(d3.axisLeft(yScale));

    }).catch(err => {
        console.error("Failed to load CSV data.", err);
        d3.select("#message").text("Failed to load CSV data. Check the path and ensure the HTTP server is running.");
    });

});

