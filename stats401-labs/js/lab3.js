d3.csv("../data/lab3_data.csv").then(data => {
    const rowsPerPage = 20;
    let currentPage = 1;
    let filteredData = data;
    let searchTerm = "";
    let selectedType = "all";
    let selectedOA = "all";
    let sortColumn = null;
    let sortAscending = true;
    const columns = [
        "id",
        "title",
        "publication_year",
        "type",
        "cited_by_count",
        "is_oa"
    ];
    const table = d3.select("#table-container").append("table");
    table.attr("aria-label", "OpenAlex works");
    const thead = table.append("thead");
    const tbody = table.append("tbody");

    const typeFilter = d3.select("#type-filter");
    typeFilter.selectAll("option.type-option")
        .data([...new Set(data.map(d => d.type))].sort())
        .join("option")
        .attr("class", "type-option")
        .attr("value", d => d)
        .text(d => d);

    function updateFilteredData() {
        const query = searchTerm.trim().toLowerCase();
        filteredData = data.filter(d => {
            const searchMatch = !query ||
                d.id.toLowerCase().includes(query) ||
                (d.title || "").toLowerCase().includes(query);
            const typeMatch = selectedType === "all" || d.type === selectedType;
            const oaMatch = selectedOA === "all" || d.is_oa === selectedOA;
            return searchMatch && typeMatch && oaMatch;
        });
        currentPage = 1;
        renderTable();
    }

    const header = thead.append("tr")
        .selectAll("th")
        .data(columns)
        .join("th");
    header.each(function(column) {
        const th = d3.select(this);
        const label = column.replaceAll("_", " ");
        th.text(label).attr("scope", "col").attr("tabindex", 0)
            .attr("aria-label", `Sort by ${label}`)
            .on("click keydown", function(event) {
                if (event.type === "keydown" && event.key !== "Enter") return;
                if (sortColumn === column) sortAscending = !sortAscending;
                else {
                    sortColumn = column;
                    sortAscending = true;
                }
                updateFilteredData();
            });
    });

    d3.select("#search-input").on("input", function() {
        searchTerm = this.value;
        updateFilteredData();
    });
    typeFilter.on("change", function() {
        selectedType = this.value;
        updateFilteredData();
    });
    d3.select("#oa-filter").on("change", function() {
        selectedOA = this.value;
        updateFilteredData();
    });

    function renderTable() {
        const sortedData = [...filteredData];
        if (sortColumn) {
            sortedData.sort((a, b) => {
                const numeric = sortColumn === "publication_year" || sortColumn === "cited_by_count";
                const comparison = numeric
                    ? +a[sortColumn] - +b[sortColumn]
                    : (a[sortColumn] || "").localeCompare(b[sortColumn] || "");
                return sortAscending ? comparison : -comparison;
            });
        }
        const start = (currentPage - 1) * rowsPerPage;
        const pageData = sortedData.slice(start, start + rowsPerPage);

        tbody.selectAll("tr")
            .data(pageData)
            .join("tr")
            .selectAll("td")
            .data(d => columns.map(column => d[column]))
            .join("td")
            .text(d => d || "—");

        if (!pageData.length) {
            tbody.append("tr").append("td")
                .attr("colspan", columns.length)
                .attr("class", "empty-state")
                .text("No works match your search.");
        }

        const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
        d3.select("#table-summary").text(`${filteredData.length} of ${data.length} works`);
        pagination.select(".page-status").text(`Page ${currentPage} of ${totalPages}`);
        pagination.select(".previous-page").property("disabled", currentPage === 1);
        pagination.select(".next-page").property("disabled", currentPage >= totalPages);
    }

    const pagination = d3.select("#pagination");
    pagination.append("button").attr("class", "previous-page")
        .text("Previous")
        .on("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    pagination.append("span").attr("class", "page-status");
    pagination.append("button").attr("class", "next-page")
        .text("Next")
        .on("click", () => {
            const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

    renderTable();
});

