document.addEventListener("DOMContentLoaded", () => {

    const binsConfig = [
        { label: "<70", min: 0, max: 70, minInclusive: true, maxInclusive: false },
        { label: "70-80", min: 70, max: 80, minInclusive: true, maxInclusive: false },
        { label: "80-90", min: 80, max: 90, minInclusive: true, maxInclusive: false },
        { label: ">90", min: 90, max: 100, minInclusive: false, maxInclusive: true }
    ];

    const margin = {
        top: 30,
        right: 20,
        bottom: 40,
        left: 40
    };

    const svgWidth = 600;
    const svgHeight = 400;

    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;

    const svg = d3.select("#chart");

    const g = svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, ${margin.top})`
        );

    const tooltip = d3.select("#tooltip");
    const details = d3.select("#student-details");

    const defs = svg.append("defs");

    const gradient = defs.append("linearGradient")
        .attr("id", "barGradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#5968d8");

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#9da9ff");
    // Load CSV
    d3.csv("../data/students.csv")
        .then(rawData => {

            const data = rawData.map(d => ({
                name: d.name,
                score: Number(d.score)
            }));

            const binCounts = binsConfig.map(bin => {

                const studentsInBin = data.filter(d => {

                    if (bin.label === ">90") {
                        return d.score > 90;
                    }

                    return (
                        d.score >= bin.min &&
                        d.score < bin.max
                    );
                });

                return {
                    label: bin.label,
                    count: studentsInBin.length,
                    students: studentsInBin
                };
            });

            const xScale = d3.scaleBand()
                .domain(binCounts.map(d => d.label))
                .range([0, chartW])
                .padding(0.22);


            const maxCount =
                d3.max(binCounts, d => d.count) || 0;


            const yScale = d3.scaleLinear()
                .domain([0, maxCount])
                .nice()
                .range([chartH, 0]);

            g.append("g")
                .attr("class", "grid")
                .call(
                    d3.axisLeft(yScale)
                        .tickSize(-chartW)
                        .tickFormat("")
                )
                .selectAll("line")
                .attr(
                    "stroke",
                    "rgba(255,255,255,0.07)"
                );

            g.selectAll(".bar")
                .data(binCounts)
                .enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", d => xScale(d.label))
                .attr("y", d => yScale(d.count))
                .attr("width", xScale.bandwidth())
                .attr(
                    "height",
                    d => chartH - yScale(d.count)
                )

                .on("mouseenter", function(event, d) {

                    tooltip
                        .html(`
                            <div class="tooltip-title">
                                Score interval
                            </div>

                            <div class="tooltip-value">
                                ${d.label}
                            </div>

                            <div>
                                ${d.count}
                                ${d.count === 1 ? "student" : "students"}
                            </div>
                        `)
                        .classed("visible", true);
                })

                .on("mousemove", function(event) {

                    tooltip
                        .style(
                            "left",
                            `${event.clientX + 16}px`
                        )
                        .style(
                            "top",
                            `${event.clientY + 16}px`
                        );
                })

                .on("mouseleave", function() {

                    tooltip
                        .classed("visible", false);
                })

                .on("click", function(event, d) {

                    event.stopPropagation();

                    const isVisible =
                        details.classed("visible");

                    const currentLabel =
                        details.attr("data-bin");


                    // Clicking the same bar again
                    // closes the panel
                    if (
                        isVisible &&
                        currentLabel === d.label
                    ) {
                        details
                            .classed("visible", false);

                        return;
                    }
                    details
                        .attr("data-bin", d.label);


                    const studentHTML =
                        d.students.length === 0
                            ? `
                                <div class="student-item">
                                    No students in this interval.
                                </div>
                              `
                            : d.students
                                .map(student => `
                                    <div class="student-item">
                                        ${student.name}
                                    </div>
                                `)
                                .join("");


                    details
                        .html(`
                            <div class="details-header">

                                <div class="details-title">
                                    Students with scores ${d.label}
                                </div>

                                <div class="details-count">
                                    ${d.count}
                                    ${d.count === 1
                                        ? "student"
                                        : "students"}
                                </div>

                            </div>

                            <div class="student-list">
                                ${studentHTML}
                            </div>
                        `)
                        .classed("visible", true);
                });

            g.append("g")
                .attr(
                    "transform",
                    `translate(0, ${chartH})`
                )
                .call(d3.axisBottom(xScale))
                .selectAll("text")
                .style("font-size", "12px");

            g.append("g")
                .call(d3.axisLeft(yScale));

            svg.on("click", function() {

                details
                    .classed("visible", false);
            });

        })

        .catch(err => {

            console.error(
                "Failed to load CSV data.",
                err
            );

            d3.select("#message")
                .text(
                    "Failed to load CSV data. " +
                    "Check the path and ensure the HTTP server is running."
                );
        });

});