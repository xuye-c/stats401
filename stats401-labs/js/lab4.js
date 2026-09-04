const width = 500;
const height = 500;

const DATA_URL = "../data/lab4_processed_tweets.csv";
const SENTIMENTS = ["Negative", "Neutral", "Positive"];
const COLORS = {
    text: "#f3f6ff",
    muted: "#8e99ad",
    pieIgnored: "#a6a2f1",
    pieNotIgnored: "#a36de9",
    sentimentNegative: "#e062cf",
    sentimentNeutral: "#7871ee",
    sentimentPositive: "#38e6b2"
};

const ignoredCriteria = {
    eng_zero: d => d.eng === 0,
    likes_zero: d => d.like_count === 0,
    retweets_zero: d => d.retweet_count === 0,
    replies_zero: d => d.reply_count === 0,
    quotes_zero: d => d.quote_count === 0,
    bookmarks_zero: d => d.bookmark_count === 0,
    like_ratio_low: (d, k) => d.like_ratio < k,
    retweet_ratio_low: (d, k) => d.retweet_ratio < k,
    reply_ratio_low: (d, k) => d.reply_ratio < k,
    quote_ratio_low: (d, k) => d.quote_ratio < k,
    bookmark_ratio_low: (d, k) => d.bookmark_ratio < k,
    eng_ratio_low: (d, k) => d.eng_ratio < 5 * k,
    impressions_zero: d => d.impression_count === 0
};

function getIgnoredMask(d, criterion, k) {
    const predicate = ignoredCriteria[criterion];
    if (!predicate) {
        throw new Error("Unknown criterion: " + criterion);
    }
    return predicate(d, k);
}

const populationPredicates = {
    all: () => true,
    positive: d => d.sentiment === "Positive",
    neutral: d => d.sentiment === "Neutral",
    negative: d => d.sentiment === "Negative"
};

function getPopulationMask(d, population) {
    const predicate = populationPredicates[population];
    if (!predicate) {
        throw new Error("Unknown population: " + population);
    }
    return predicate(d);
}

const visualizationRow = d3.select("#visualization-row");
const svg = visualizationRow
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Part 2: engagement distribution among non-ignored tweets.
const histogramWidth = 700;
const histogramHeight = 430;
const histogramMargin = {
    top: 88,
    right: 28,
    bottom: 72,
    left: 64
};

const histogramSvg = visualizationRow
    .append("svg")
    .attr("width", histogramWidth)
    .attr("height", histogramHeight)
    .attr(
        "aria-label",
        "Engagement distribution among non-ignored tweets"
    );

const part2Histogram = histogramSvg.append("g")
    .attr("class", "part2-histogram")
    .attr(
        "transform",
        `translate(${histogramMargin.left},${histogramMargin.top})`
    );

const histogramPlotWidth =
    histogramWidth -
    histogramMargin.left -
    histogramMargin.right;

const histogramPlotHeight =
    histogramHeight -
    histogramMargin.top -
    histogramMargin.bottom;

const histogramBars = part2Histogram.append("g")
    .attr("class", "histogram-bars");

const histogramXAxis = part2Histogram.append("g")
    .attr("class", "histogram-x-axis")
    .attr(
        "transform",
        `translate(0,${histogramPlotHeight})`
    );

const histogramYAxis = part2Histogram.append("g")
    .attr("class", "histogram-y-axis");

const histogramTitle = histogramSvg.append("text")
    .attr("class", "histogram-title")
    .attr("x", histogramWidth / 2)
    .attr("y", 42)
    .attr("text-anchor", "middle")
    .text("Engagement distribution");

const histogramSubtitle = histogramSvg.append("text")
    .attr("class", "histogram-subtitle")
    .attr("x", histogramWidth / 2)
    .attr("y", 64)
    .attr("text-anchor", "middle")
    .text("Non-ignored tweets");

histogramSvg.append("text")
    .attr("class", "histogram-y-label")
    .attr(
        "transform",
        `translate(18,${histogramMargin.top +
            histogramPlotHeight / 2}) rotate(-90)`
    )
    .attr("text-anchor", "middle")
    .text("Tweet count");

histogramSvg.append("text")
    .attr("class", "histogram-x-label")
    .attr("x", histogramWidth / 2)
    .attr("y", histogramHeight - 18)
    .attr("text-anchor", "middle")
    .text("Engagement");
const tooltip = d3.select("body")
    .selectAll("#histogram-tooltip")
    .data([null])
    .join("div")
    .attr("id", "histogram-tooltip")
    .style("display", "none");
function moveTooltip(event) {
    const tooltipNode = tooltip.node();

    if (!tooltipNode) {
        return;
    }

    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;

    const padding = 12;

    let left = event.clientX + padding;
    let top = event.clientY + padding;

    if (left + tooltipWidth > window.innerWidth - padding) {
        left = event.clientX - tooltipWidth - padding;
    }

    if (top + tooltipHeight > window.innerHeight - padding) {
        top = event.clientY - tooltipHeight - padding;
    }

    tooltip
        .style("left", `${left}px`)
        .style("top", `${top}px`);
}

function showTooltip(event, title, lines) {
    tooltip
        .style("display", "block")
        .html(`<strong>${title}</strong>${lines.map(line => `<br>${line}`).join("")}`);
    moveTooltip(event);
}

function hideTooltip() {
    tooltip.style("display", "none");
}
// Part 1 layers are created once and updated when the controls change.
const pieGroup = svg.append("g")
    .attr("class", "part1-pie")
    .attr("transform", `translate(${width / 2},165)`);
svg.append("text")
    .attr("class", "pie-title")
    .attr("x", width / 2)
    .attr("y", 42)
    .attr("text-anchor", "middle")
    .text("Ignored vs. Not ignored");
const pieLegend = svg.append("g")
    .attr("class", "part1-legend")
    .attr("transform", "translate(145,300)");
pieLegend.append("text")
    .attr("class", "legend-heading")
    .attr("fill", COLORS.muted)
    .attr("y", -12)
    .text("Category                 Count       Percentage");
const sentimentGroup = svg.append("g")
    .attr("class", "sentiment-composition")
    .attr("transform", "translate(45,385)");
sentimentGroup.append("text")
    .attr("class", "sentiment-heading")
    .attr("fill", COLORS.muted)
    .attr("y", -14)
    .text("Sentiment composition");

const pieRadius = 105;
const pie = d3.pie()
    .sort(null)
    .value(d => d.value);
const pieArc = d3.arc()
    .innerRadius(0)
    .outerRadius(pieRadius);
const pieColors = {
    "Ignored": COLORS.pieIgnored,
    "Not ignored": COLORS.pieNotIgnored
};
const sentimentColors = {
    "Negative": COLORS.sentimentNegative,
    "Neutral": COLORS.sentimentNeutral,
    "Positive": COLORS.sentimentPositive
};
const sentimentBarWidth = width - 90;
const sentimentBarHeight = 30;
const sentimentScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, sentimentBarWidth]);


function preprocessTweet(d) {
    const interactionFields = [
        "like_count",
        "retweet_count",
        "reply_count",
        "quote_count",
        "bookmark_count"
    ];

    interactionFields.forEach(field => {
        d[field] = +d[field];
    });
    d.impression_count = +d.impression_count;
    d.sentiment_score = +d.sentiment_score;
    d.eng = d3.sum(interactionFields, field => d[field]);

    const impressions = d.impression_count;
    interactionFields.forEach(field => {
        const ratioName = field.replace("_count", "_ratio");
        d[ratioName] = impressions === 0 ? 0 : d[field] / impressions;
    });
    d.eng_ratio = impressions === 0 ? 0 : d.eng / impressions;
    return d;
}

d3.csv(DATA_URL).then(function(data) {
    data.forEach(preprocessTweet);

    function createSelectControl(container, className, label, id, options) {
        const field = container
            .append("label")
            .attr("class", `control-field ${className}`)
            .text(`${label}: `);
        const select = field
            .append("select")
            .attr("id", id);
        select.selectAll("option")
            .data(options)
            .enter()
            .append("option")
            .attr("value", d => d.value)
            .text(d => d.label);
        return select;
    }

    // Create the shared filtering controls.
    const criterionOptions = [
        { value: "eng_zero", label: "Engagement = 0" },
        { value: "likes_zero", label: "Likes = 0" },
        { value: "retweets_zero", label: "Retweets = 0" },
        { value: "replies_zero", label: "Replies = 0" },
        { value: "quotes_zero", label: "Quotes = 0" },
        { value: "bookmarks_zero", label: "Bookmarks = 0" },
        { value: "like_ratio_low", label: "Like ratio < k" },
        { value: "retweet_ratio_low", label: "Retweet ratio < k" },
        { value: "reply_ratio_low", label: "Reply ratio < k" },
        { value: "quote_ratio_low", label: "Quote ratio < k" },
        { value: "bookmark_ratio_low", label: "Bookmark ratio < k" },
        { value: "eng_ratio_low", label: "Engagement ratio < 5k" },
        { value: "impressions_zero", label: "Impressions = 0" }
    ];
    const criterionSelect = createSelectControl(
        d3.select("#controls"),
        "criterion-field",
        "Criterion",
        "criterion-select",
        criterionOptions
    );

    const populationOptions = [
        { value: "all", label: "All tweets" },
        { value: "positive", label: "Positive" },
        { value: "neutral", label: "Neutral" },
        { value: "negative", label: "Negative" }
    ];
    const populationSelect = createSelectControl(
        d3.select("#controls"),
        "population-field",
        "Population",
        "population-select",
        populationOptions
    );
    //k slider
    const kContainer = d3.select("#controls")
        .append("label")
        .attr("class", "control-field k-field")
        .text(" k: ");
    const kSlider = kContainer
        .append("input")
        .attr("type", "range")
        .attr("id", "k-slider")
        .attr("min", 0)
        .attr("max", 0.1)
        .attr("step", 0.001)
        .attr("value", 0.01);
    const kValue = kContainer
        .append("span")
        .attr("id", "k-value")
        .style("display", "inline-block")
        .style("width", "45px")
        .text("0.010");
    
    function updateHistogram(nonIgnoredData) {
        const values = nonIgnoredData
            .map(d => d.eng)
            .filter(Number.isFinite);
        const bins = d3.range(0, 100, 10).map(x0 => ({
            x0: x0,
            x1: x0 + 10,
            label: `${x0}-${x0 + 10}`,
            values: []
        }));
        bins.push({
            x0: 100,
            x1: Infinity,
            label: "100+",
            values: []
        });

        values.forEach(function(value) {
            if (value >= 100) {
                bins[bins.length - 1].values.push(value);
            } else {
                const index = Math.floor(value / 10);
                bins[index].values.push(value);
            }
        });

        const x = d3.scaleBand()
            .domain(bins.map(bin => bin.label))
            .range([0, histogramPlotWidth])
            .padding(0.12);

        const maxCount = d3.max(
            bins,
            bin => bin.values.length
        ) || 0;

        const y = d3.scaleLinear()
            .domain([0, Math.max(1, maxCount)])
            .nice()
            .range([histogramPlotHeight, 0]);

        histogramXAxis.call(d3.axisBottom(x));
        histogramYAxis.call(
            d3.axisLeft(y).ticks(5)
        );

        histogramBars
            .selectAll("rect")
            .data(
                bins,
                bin => bin.label
            )
            .join("rect")
            .attr("x", bin => x(bin.label))
            .attr("y", bin => y(bin.values.length))
            .attr("width", x.bandwidth())
            .attr(
                "height",
                bin =>
                    histogramPlotHeight -
                    y(bin.values.length)
            )
            .attr("fill", "#a36de9")
            .attr("rx", 3)
            .on("mouseover", function(event, bin) {
                const percentage =
                    values.length === 0
                        ? 0
                        : bin.values.length /
                        values.length *
                        100;

                showTooltip(event, `Engagement: ${bin.label}`, [
                    `Tweet count: ${bin.values.length}`,
                    `Share: ${percentage.toFixed(1)}%`
                ]);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip);
    }

    function update() {
        const criterion = criterionSelect.property("value");
        const population = populationSelect.property("value");
        const k = +kSlider.property("value");
        const populationData = data.filter(function(d) {return getPopulationMask(d, population);});
        const ignoredData = populationData.filter(function(d) {return getIgnoredMask(d, criterion, k);});
        // Part 2 analyzes only the tweets left after removing ignoredData.
        const ignoredSet = new Set(ignoredData);
        const nonIgnoredData = populationData.filter(d => !ignoredSet.has(d));
        kValue.text(k.toFixed(3));
        // Update the ignored/not-ignored pie from the current population.
        const pieData = [
            { label: "Ignored", value: ignoredData.length },
            { label: "Not ignored", value: populationData.length - ignoredData.length }
        ];
        const populationSize = populationData.length;
        pieGroup.selectAll("path")
            .data(pie(pieData), d => d.data.label)
            .join("path")
            .attr("fill", d => pieColors[d.data.label])
            .attr("stroke", "#080b12")
            .attr("stroke-width", 2)
            .attr("d", pieArc)
            .on("mouseover", function(event, d) {
                const percentage = populationSize === 0
                    ? 0
                    : d.data.value / populationSize * 100;
                showTooltip(event, d.data.label, [
                    `Tweet count: ${d.data.value}`,
                    `Share: ${percentage.toFixed(1)}%`
                ]);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip);

        pieGroup.selectAll("text.pie-center")
            .data([populationSize])
            .join("text")
            .attr("class", "pie-center")
            .attr("fill", COLORS.text)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("pointer-events", "none")
            .text(d => `${d} tweets`);

        const legendData = pieData.map(d => ({
            ...d,
            percentage: populationSize === 0 ? 0 : d.value / populationSize
        }));
        const legendRows = pieLegend.selectAll("g.legend-row")
            .data(legendData, d => d.label)
            .join(enter => {
                const row = enter.append("g").attr("class", "legend-row");
                row.append("rect").attr("width", 10).attr("height", 10);
                row.append("text")
                    .attr("x", 18)
                    .attr("dy", "0.8em")
                    .attr("fill", COLORS.text);
                return row;
            })
            .attr("transform", (d, i) => `translate(0,${i * 23})`);
        legendRows.select("rect").attr("fill", d => pieColors[d.label]);
        legendRows.select("text")
            .text(d => `${d.label.padEnd(15)} ${String(d.value).padStart(5)}       ${(d.percentage * 100).toFixed(1)}%`);

        // Show the all-tweets sentiment composition only for the all population.
        const showComposition = population === "all";
        sentimentGroup.style("display", showComposition ? null : "none");
        if (showComposition) {
            const sentimentData = SENTIMENTS.map(sentiment => ({
                sentiment,
                value: data.filter(d => d.sentiment === sentiment).length
            }));
            const totalTweets = data.length;
            let offset = 0;
            sentimentGroup.selectAll("rect.sentiment-segment")
                .data(sentimentData, d => d.sentiment)
                .join("rect")
                .attr("class", "sentiment-segment")
                .attr("y", 0)
                .attr("height", sentimentBarHeight)
                .attr("fill", d => sentimentColors[d.sentiment])
                .attr("x", d => {
                    const x = offset;
                    offset += totalTweets === 0 ? 0 : sentimentScale(d.value / totalTweets);
                    return x;
                })
                .attr("width", d => totalTweets === 0 ? 0 : sentimentScale(d.value / totalTweets))
                    .on("mouseover", function(event, d) {
                const percentage =
                    totalTweets === 0
                        ? 0
                        : d.value / totalTweets * 100;

                showTooltip(event, d.sentiment, [
                    `Tweet count: ${d.value}`,
                    `Share: ${percentage.toFixed(1)}%`
                ]);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip);

            const sentimentLegend = sentimentGroup.selectAll("text.sentiment-label")
                .data(sentimentData, d => d.sentiment)
                .join("text")
                .attr("class", "sentiment-label")
                .attr("fill", COLORS.muted)
                .attr("y", 52);
            let labelOffset = 0;
            sentimentLegend
                .attr("x", d => {
                    const x = labelOffset;
                    labelOffset += 130;
                    return x;
                })
                .text(d => `${d.sentiment}: ${(d.value / totalTweets * 100).toFixed(1)}%`);
        }
        updateHistogram(nonIgnoredData);

        //console.log("Criterion:", criterion);
        //console.log("Population:", population);
        //console.log("k:", k);
        //console.log("Population size:", populationData.length);
        //console.log("Ignored size:", ignoredData.length);
    }
    criterionSelect.on("change", update);
    populationSelect.on("change", update);  
    kSlider.on("input", update);

    update();
});