import { Chart, registerables } from 'chart.js';
    import 'chartjs-adapter-date-fns';
    import Papa from 'papaparse';

    // Register Chart.js components
    Chart.register(...registerables);

    document.addEventListener('DOMContentLoaded', () => {
      const fileInput = document.getElementById('csvFileInput');
      const chartCanvas = document.getElementById('chart');
      const xAxisSelect = document.getElementById('xAxisSelect');
      const yAxisSelect = document.getElementById('yAxisSelect');
      const visualizeBtn = document.getElementById('visualizeBtn');
      const filterControls = document.getElementById('filterControls');
      const filterGroups = document.getElementById('filterGroups');
      let chart;
      let csvData = [];
      let headers = [];
      let filters = {};

      // Set initial canvas size
      chartCanvas.width = 800;
      chartCanvas.height = 500;

      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          complete: (results) => {
            csvData = processData(results.data);
            headers = results.meta.fields.concat(['TENOR', 'IsBackstart']);
            populateControls();
            filterControls.style.display = 'block';
            enableControls();
          }
        });
      });

      function enableControls() {
        xAxisSelect.disabled = false;
        yAxisSelect.disabled = false;
        visualizeBtn.disabled = false;
        document.querySelectorAll('.filter-select').forEach(select => {
          select.disabled = false;
        });
      }

      function processData(data) {
        return data.map(row => {
          // Calculate TENOR
          const effectiveDate = new Date(row.EFFECTIVE_DATE);
          const expirationDate = new Date(row.EXPIRATION_DATE);
          const tenorDays = Math.floor((expirationDate - effectiveDate) / (1000 * 60 * 60 * 24));
          const tenor = formatTenor(tenorDays);
          
          // Calculate IsBackstart
          const executionTimestamp = new Date(row.EXECUTION_TIMESTAMP_UTC);
          const isBackstart = effectiveDate < executionTimestamp;

          return {
            ...row,
            TENOR: tenor,
            IsBackstart: isBackstart
          };
        });
      }

      function formatTenor(days) {
        if (days > 360) {
          const years = Math.round(days / 365);
          return `${years}Y`;
        } else {
          const months = Math.floor(days / 30);
          // Round to nearest standard tenor: 1, 3, 6, 9 months
          const standardTenors = [1, 3, 6, 9];
          const nearest = standardTenors.reduce((prev, curr) => {
            return (Math.abs(curr - months) < Math.abs(prev - months) ? curr : prev);
          });
          return `${nearest}M`;
        }
      }

      function formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      function populateControls() {
        // Clear previous options
        xAxisSelect.innerHTML = '<option value="">Select X Axis</option>';
        yAxisSelect.innerHTML = '<option value="">Select Y Axis</option>';
        filterGroups.innerHTML = '';

        // Add new options
        headers.forEach(header => {
          xAxisSelect.innerHTML += `<option value="${header}">${header}</option>`;
          yAxisSelect.innerHTML += `<option value="${header}">${header}</option>`;
          
          // Add filter controls
          const uniqueValues = [...new Set(csvData
            .map(row => row[header])
            .filter(value => value !== null && value !== undefined)
          )];
          const filterGroup = document.createElement('div');
          filterGroup.className = 'filter-group';
          filterGroup.innerHTML = `
            <label>${header}:</label>
            <select multiple class="filter-select" data-field="${header}" disabled>
              ${uniqueValues.map(value => `<option value="${value}">${value}</option>`).join('')}
            </select>
          `;
          filterGroups.appendChild(filterGroup);
        });

        // Add event listeners to filter selects
        document.querySelectorAll('.filter-select').forEach(select => {
          select.addEventListener('change', updateFilters);
        });
      }

      function updateFilters() {
        filters = {};
        document.querySelectorAll('.filter-select').forEach(select => {
          const field = select.dataset.field;
          const selectedValues = Array.from(select.selectedOptions)
            .map(option => option.value)
            .filter(value => value !== '');
          if (selectedValues.length > 0) {
            filters[field] = selectedValues;
          }
        });
      }

      function filterData(data) {
        return data.filter(row => {
          return Object.entries(filters).every(([field, values]) => {
            const rowValue = row[field];
            if (rowValue === null || rowValue === undefined) return false;
            return values.includes(rowValue.toString());
          });
        });
      }

      visualizeBtn.addEventListener('click', () => {
        const xAxis = xAxisSelect.value;
        const yAxis = yAxisSelect.value;

        if (!xAxis || !yAxis) {
          alert('Please select both X and Y axes');
          return;
        }

        if (chart) chart.destroy();

        const filteredData = filterData(csvData);
        const labels = filteredData.map(row => {
          // Format dates if the x-axis is a date field
          if (['EFFECTIVE_DATE', 'EXPIRATION_DATE', 'EXECUTION_TIMESTAMP_UTC'].includes(xAxis)) {
            return new Date(row[xAxis]);
          }
          return row[xAxis];
        });
        const data = filteredData.map(row => row[yAxis]);

        chart = new Chart(chartCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: yAxis,
              data: data,
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'time',
                time: {
                  parser: 'yyyy-MM-dd',
                  tooltipFormat: 'yyyy-MM-dd',
                  unit: 'day'
                },
                ticks: {
                  autoSkip: true,
                  maxTicksLimit: 10
                }
              },
              y: {
                beginAtZero: true
              }
            }
          }
        });
      });
    });
