// Freight AI Demo - Main Application Script
// This file will contain the JavaScript logic for the dashboard

console.log('Freight AI Demo loaded');

// Cost per delay day constant (USD/day) - can be overridden via URL parameter ?cpd=NUMBER
const COST_PER_DELAY_DAY = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    const cpdParam = urlParams.get('cpd');
    return cpdParam ? parseFloat(cpdParam) || 120 : 120;
})();

// Global variables to store chart instances
let delayByCarrierChart = null;
let riskDistributionChart = null;
let costDistanceChart = null;
let modeEmissionsChart = null;
let dataTable = null;

// Helper function to safely convert values to numbers
function num(v) {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

// Helper function to compute savings potential from late shipments
function computeSavingsPotential(rows) {
    if (!rows || rows.length === 0) {
        return 0;
    }

    const totalSavings = rows.reduce((sum, row) => {
        const delayDays = num(row.DelayDays || row.delay_days || row.delay || row.Delay || 0);
        return sum + (delayDays > 0 ? delayDays * COST_PER_DELAY_DAY : 0);
    }, 0);

    return totalSavings;
}

// Function to compute and update KPIs
function updateKPIs(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for KPI calculation');
        return;
    }

    // Total Shipments = number of rows
    const totalShipments = rows.length;
    document.getElementById('kpi-total-shipments').textContent = totalShipments;

    // On-Time % = % of rows where DelayDays <= 0
    // Assuming the delay field is named 'actual_delay_days' or similar
    const onTimeRows = rows.filter(row => {
        const delayDays = num(row.actual_delay_days || row.DelayDays || 0);
        return delayDays <= 0;
    });
    const onTimePercentage = ((onTimeRows.length / totalShipments) * 100).toFixed(1);
    document.getElementById('kpi-on-time').textContent = `${onTimePercentage}%`;

    // Avg Delay = average of DelayDays (only for late shipments)
    const lateShipments = rows.filter(row => {
        const delayDays = num(row.actual_delay_days || row.DelayDays || 0);
        return delayDays > 0;
    });
    
    if (lateShipments.length > 0) {
        const totalDelay = lateShipments.reduce((sum, row) => {
            return sum + num(row.actual_delay_days || row.DelayDays || 0);
        }, 0);
        const avgDelay = (totalDelay / lateShipments.length).toFixed(1);
        document.getElementById('kpi-avg-delay').textContent = `${avgDelay} days`;
    } else {
        document.getElementById('kpi-avg-delay').textContent = '0 days';
    }

    // Calculate and display savings potential
    const savings = computeSavingsPotential(rows);
    // Placeholder logic for demo purposes - show demo value if no actual savings
    const displaySavings = savings > 0 ? savings : 187923; // Demo value when no real savings
    document.getElementById('kpi-savings').textContent = `$${Math.round(displaySavings).toLocaleString()}`;
    
    // For now, leave Est. CO₂ as -
    document.getElementById('kpi-co2').textContent = '-';

    console.log('KPIs updated:', {
        totalShipments,
        onTimePercentage: `${onTimePercentage}%`,
        avgDelay: lateShipments.length > 0 ? `${(lateShipments.reduce((sum, row) => sum + num(row.actual_delay_days || row.DelayDays || 0), 0) / lateShipments.length).toFixed(1)} days` : '0 days'
    });
}

// Function to create delay by carrier chart
function createDelayByCarrierChart(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for delay by carrier chart');
        return;
    }

    // Group data by carrier and compute average delay
    const carrierData = {};
    
    rows.forEach(row => {
        const carrier = row.carrier_name || row.Carrier || row.carrier || 'Unknown';
        const delayDays = num(row.actual_delay_days || row.DelayDays || 0);
        
        if (!carrierData[carrier]) {
            carrierData[carrier] = {
                totalDelay: 0,
                count: 0
            };
        }
        
        carrierData[carrier].totalDelay += delayDays;
        carrierData[carrier].count += 1;
    });

    // Filter carriers with at least 5 shipments and compute averages
    const filteredCarriers = Object.entries(carrierData)
        .filter(([carrier, data]) => data.count >= 5)
        .map(([carrier, data]) => ({
            name: carrier,
            avgDelay: data.totalDelay / data.count,
            count: data.count
        }))
        .sort((a, b) => b.avgDelay - a.avgDelay); // Sort by average delay descending

    if (filteredCarriers.length === 0) {
        console.warn('No carriers with at least 5 shipments found');
        return;
    }

    // Destroy existing chart if it exists
    if (delayByCarrierChart) {
        delayByCarrierChart.destroy();
        delayByCarrierChart = null;
    }

    // Get chart container
    const ctx = document.getElementById('chart-delay-by-carrier');
    if (!ctx) {
        console.error('Chart container not found');
        return;
    }

    // Clear any existing content
    ctx.innerHTML = '';

    // Create new canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'delay-by-carrier-canvas';
    ctx.appendChild(canvas);

    // Create the chart
    delayByCarrierChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: filteredCarriers.map(carrier => carrier.name),
            datasets: [{
                label: 'Avg Delay (days)',
                data: filteredCarriers.map(carrier => carrier.avgDelay.toFixed(1)),
                backgroundColor: 'rgba(30, 58, 138, 0.8)', // Dark blue color
                borderColor: 'rgba(30, 58, 138, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false // We'll use the HTML title
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Avg Delay (days)',
                        color: 'rgba(55, 65, 81, 0.8)'
                    },
                    ticks: {
                        color: 'rgba(55, 65, 81, 0.7)'
                    },
                    grid: {
                        color: 'rgba(55, 65, 81, 0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Carrier',
                        color: 'rgba(55, 65, 81, 0.8)'
                    },
                    ticks: {
                        color: 'rgba(55, 65, 81, 0.7)'
                    },
                    grid: {
                        color: 'rgba(55, 65, 81, 0.1)'
                    }
                }
            }
        }
    });

    console.log('Delay by carrier chart created:', filteredCarriers);
}

// Function to create risk distribution doughnut chart
function createRiskDistributionChart(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for risk distribution chart');
        return;
    }

    // Count shipments by risk level
    const riskCounts = {};
    
    rows.forEach(row => {
        const riskLevel = row.risk_level || row.RiskLevel || row.risk || row.ai_risk_score || 'Unknown';
        
        // Normalize risk level to standard format
        let normalizedRisk = 'Unknown';
        if (typeof riskLevel === 'string') {
            const lowerRisk = riskLevel.toLowerCase();
            if (lowerRisk.includes('low') || lowerRisk === 'l') {
                normalizedRisk = 'Low';
            } else if (lowerRisk.includes('medium') || lowerRisk.includes('med') || lowerRisk === 'm') {
                normalizedRisk = 'Medium';
            } else if (lowerRisk.includes('high') || lowerRisk === 'h') {
                normalizedRisk = 'High';
            } else if (lowerRisk.includes('critical') || lowerRisk.includes('crit')) {
                normalizedRisk = 'Critical';
            } else {
                // Try to categorize by numeric risk score
                const riskScore = num(riskLevel);
                if (!isNaN(riskScore)) {
                    if (riskScore <= 0.3) {
                        normalizedRisk = 'Low';
                    } else if (riskScore <= 0.6) {
                        normalizedRisk = 'Medium';
                    } else if (riskScore <= 0.8) {
                        normalizedRisk = 'High';
                    } else {
                        normalizedRisk = 'Critical';
                    }
                } else {
                    normalizedRisk = riskLevel; // Keep original if can't categorize
                }
            }
        } else if (typeof riskLevel === 'number') {
            // Numeric risk score
            if (riskLevel <= 0.3) {
                normalizedRisk = 'Low';
            } else if (riskLevel <= 0.6) {
                normalizedRisk = 'Medium';
            } else if (riskLevel <= 0.8) {
                normalizedRisk = 'High';
            } else {
                normalizedRisk = 'Critical';
            }
        }
        
        riskCounts[normalizedRisk] = (riskCounts[normalizedRisk] || 0) + 1;
    });

    // Convert to arrays for Chart.js
    const labels = Object.keys(riskCounts);
    const data = Object.values(riskCounts);

    if (labels.length === 0) {
        console.warn('No risk level data found');
        return;
    }

    // Define colors for different risk levels (dark blue theme)
    const getRiskColor = (riskLevel) => {
        switch (riskLevel.toLowerCase()) {
            case 'low': return 'rgba(30, 58, 138, 0.6)'; // Dark blue
            case 'medium': return 'rgba(30, 58, 138, 0.8)'; // Dark blue
            case 'high': return 'rgba(30, 58, 138, 1)'; // Dark blue
            case 'critical': return 'rgba(15, 23, 42, 0.9)'; // Darker blue
            default: return 'rgba(30, 58, 138, 0.7)'; // Dark blue
        }
    };

    const colors = labels.map(riskLevel => getRiskColor(riskLevel));

    // Destroy existing chart if it exists
    if (riskDistributionChart) {
        riskDistributionChart.destroy();
        riskDistributionChart = null;
    }

    // Get chart container
    const ctx = document.getElementById('chart-risk');
    if (!ctx) {
        console.error('Risk chart container not found');
        return;
    }

    // Clear any existing content
    ctx.innerHTML = '';

    // Create new canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'risk-distribution-canvas';
    ctx.appendChild(canvas);

    // Create the doughnut chart
    riskDistributionChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => color),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false // We'll use the HTML title
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        color: 'rgba(55, 65, 81, 0.8)'
                    }
                }
            },
            cutout: '60%' // Makes it a doughnut instead of pie
        }
    });

    console.log('Risk distribution chart created:', { labels, data, riskCounts });
}

// Function to create cost vs distance scatter chart
function createCostDistanceChart(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for cost vs distance chart');
        return;
    }

    // Build array of points { x: distanceKm, y: costUSD, shipmentId }
    const scatterData = rows.map(row => {
        const distanceKm = num(row.route_distance_km || row.DistanceKm || row.distance_km || 0);
        const costUSD = num(row.cost_usd || row.CostUSD || row.cost || 0);
        const shipmentId = row.shipment_id || row.ShipmentId || row.shipment || 'Unknown';
        
        return {
            x: distanceKm,
            y: costUSD,
            shipmentId: shipmentId
        };
    }).filter(point => point.x > 0 && point.y > 0); // Filter out invalid data points

    if (scatterData.length === 0) {
        console.warn('No valid cost/distance data found for scatter chart');
        return;
    }

    // Destroy existing chart if it exists
    if (costDistanceChart) {
        costDistanceChart.destroy();
        costDistanceChart = null;
    }

    // Get chart container
    const ctx = document.getElementById('chart-cost-distance');
    if (!ctx) {
        console.error('Cost vs distance chart container not found');
        return;
    }

    // Clear any existing content
    ctx.innerHTML = '';

    // Create new canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'cost-distance-canvas';
    ctx.appendChild(canvas);

    // Create the scatter chart
    costDistanceChart = new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Shipments',
                data: scatterData,
                backgroundColor: 'rgba(30, 58, 138, 0.7)', // Semi-transparent dark blue
                borderColor: 'rgba(30, 58, 138, 0.8)',
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: 'rgba(30, 58, 138, 0.9)',
                pointHoverBorderColor: 'rgba(30, 58, 138, 1)',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false // We'll use the HTML title
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `Shipment: ${point.shipmentId}\nDistance: ${point.x.toLocaleString()} km\nCost: $${point.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Distance (km)',
                        color: 'rgba(55, 65, 81, 0.8)'
                    },
                    ticks: {
                        color: 'rgba(55, 65, 81, 0.7)',
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(55, 65, 81, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Cost (USD)',
                        color: 'rgba(55, 65, 81, 0.8)'
                    },
                    ticks: {
                        color: 'rgba(55, 65, 81, 0.7)',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(55, 65, 81, 0.1)'
                    }
                }
            }
        }
    });

    console.log('Cost vs distance scatter chart created:', {
        pointCount: scatterData.length,
        samplePoints: scatterData.slice(0, 5)
    });
}

// Function to create data preview table
function createDataPreviewTable(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for data preview table');
        return;
    }

    // Get table container
    const container = document.getElementById('table-container');
    if (!container) {
        console.error('Table container not found');
        return;
    }

    // Clear any existing content
    container.innerHTML = '';

    // Show first 10 rows for preview
    const previewRows = rows.slice(0, 10);
    
    // Get all unique column names from the data
    const allColumns = new Set();
    rows.forEach(row => {
        Object.keys(row).forEach(key => allColumns.add(key));
    });
    
    // Select key columns to display (prioritize important ones)
    const keyColumns = [
        'shipment_id', 'ShipmentId', 'shipment',
        'carrier', 'carrier_name', 'Carrier',
        'origin_city', 'destination_city',
        'transport_mode', 'mode',
        'weight_kg', 'volume_m3',
        'route_distance_km', 'distance_km',
        'cost_usd', 'cost',
        'actual_delay_days', 'delay_days',
        'risk_level', 'risk', 'ai_risk_score'
    ];
    
    // Filter to only show columns that exist in the data, avoiding duplicates
    const displayColumns = [];
    const usedColumns = new Set();
    
    keyColumns.forEach(col => {
        // Find the actual column name in the data (case-insensitive)
        const actualCol = Array.from(allColumns).find(key => 
            key.toLowerCase() === col.toLowerCase() ||
            key.replace(/_/g, '').toLowerCase() === col.replace(/_/g, '').toLowerCase()
        );
        
        if (actualCol && !usedColumns.has(actualCol.toLowerCase())) {
            displayColumns.push(actualCol);
            usedColumns.add(actualCol.toLowerCase());
        }
    });
    
    // If no key columns found, show first 8 columns
    const finalColumns = displayColumns.length > 0 ? displayColumns : Array.from(allColumns).slice(0, 8);

    // Create table HTML
    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-white/20">
                <thead class="bg-gray-100">
                    <tr>
                        ${finalColumns.map(col => `
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                ${col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${previewRows.map(row => `
                        <tr class="hover:bg-gray-50 transition-colors">
                            ${finalColumns.map(col => {
                                // Find the actual column name in the row (case-insensitive)
                                const actualCol = Object.keys(row).find(key => 
                                    key.toLowerCase() === col.toLowerCase() ||
                                    key.replace(/_/g, '').toLowerCase() === col.replace(/_/g, '').toLowerCase()
                                );
                                const value = actualCol ? row[actualCol] : '';
                                
                                // Format the value for display
                                let displayValue = value;
                                if (typeof value === 'number') {
                                    if (col.includes('cost') || col.includes('usd')) {
                                        displayValue = `$${value.toLocaleString()}`;
                                    } else if (col.includes('weight') || col.includes('kg')) {
                                        displayValue = `${value.toLocaleString()} kg`;
                                    } else if (col.includes('distance') || col.includes('km')) {
                                        displayValue = `${value.toLocaleString()} km`;
                                    } else {
                                        displayValue = value.toLocaleString();
                                    }
                                } else if (typeof value === 'boolean') {
                                    displayValue = value ? 'Yes' : 'No';
                                } else if (value === null || value === undefined) {
                                    displayValue = '-';
                                }
                                
                                return `
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ${displayValue}
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="mt-4 text-sm text-gray-600 text-center">
            Showing ${previewRows.length} of ${rows.length} shipments
        </div>
    `;

    container.innerHTML = tableHTML;

    console.log('Data preview table created:', {
        totalRows: rows.length,
        previewRows: previewRows.length,
        columns: finalColumns
    });
}

// Function to create mode vs emissions chart
function createModeEmissionsChart(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for mode emissions chart');
        return;
    }

    // Demo factors for CO2 emissions estimation (illustrative purposes only)
    // Values in g CO2 per ton-km (grams per ton-kilometer)
    const factors = { 
        Air: 500, 
        Road: 62, 
        Rail: 22, 
        Sea: 10 
    };

    // Aggregate emissions by transport mode
    const modeEmissions = {};
    let totalEmissions = 0;

    rows.forEach(row => {
        // Get transport mode
        const mode = row.transport_mode || row.mode || row.Mode || 'Unknown';
        
        // Get actual emissions if available
        let emissionsKg = num(row.emissions_kg || row.EmissionsKg || row.carbon_emissions_kg || 0);
        
        // If no actual emissions data, estimate using demo factors
        if (emissionsKg <= 0) {
            const distanceKm = num(row.route_distance_km || row.distance_km || row.DistanceKm || 0);
            const weightKg = num(row.weight_kg || row.WeightKg || 0);
            const tons = weightKg > 0 ? weightKg / 1000 : 1; // Assume 1 ton if no weight data
            
            // Get factor for this mode (default to Road if unknown)
            const factor = factors[mode] || factors.Road;
            
            // Calculate: (distance_km * factor_g_per_tkm * tons) / 1000
            emissionsKg = (distanceKm * factor * tons) / 1000;
        }

        // Aggregate by mode
        if (!modeEmissions[mode]) {
            modeEmissions[mode] = 0;
        }
        modeEmissions[mode] += emissionsKg;
        totalEmissions += emissionsKg;
    });

    // Convert to arrays for Chart.js
    const modes = Object.keys(modeEmissions);
    const emissions = Object.values(modeEmissions).map(val => Math.round(val));

    if (modes.length === 0) {
        console.warn('No transport mode data found for emissions chart');
        return;
    }

    // Destroy existing chart if it exists
    if (modeEmissionsChart) {
        modeEmissionsChart.destroy();
        modeEmissionsChart = null;
    }

    // Get chart container
    const ctx = document.getElementById('chart-mode-emissions');
    if (!ctx) {
        console.error('Mode emissions chart container not found');
        return;
    }

    // Clear any existing content
    ctx.innerHTML = '';

    // Create new canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'mode-emissions-canvas';
    ctx.appendChild(canvas);

    // Create the bar chart
    modeEmissionsChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: modes,
            datasets: [{
                label: 'CO₂ (kg)',
                data: emissions,
                backgroundColor: 'rgba(30, 58, 138, 0.8)', // Dark blue color for emissions
                borderColor: 'rgba(30, 58, 138, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false // We'll use the HTML title
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'CO₂ (kg)',
                        color: 'rgba(55, 65, 81, 0.8)'
                    },
                    ticks: {
                        color: 'rgba(55, 65, 81, 0.7)',
                        callback: function(value) {
                            return value.toLocaleString() + ' kg';
                        }
                    },
                    grid: {
                        color: 'rgba(55, 65, 81, 0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mode',
                        color: 'rgba(55, 65, 81, 0.8)'
                    },
                    ticks: {
                        color: 'rgba(55, 65, 81, 0.7)'
                    },
                    grid: {
                        color: 'rgba(55, 65, 81, 0.1)'
                    }
                }
            }
        }
    });

    console.log('Mode emissions chart created:', { modes, emissions, totalEmissions });
    
    // Return total emissions for KPI update
    return totalEmissions;
}

// Function to render AI insights
function renderInsights(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for insights');
        return;
    }

    const insights = [];
    
    // 0. Savings potential insight
    const savings = computeSavingsPotential(rows);
    insights.push(`Money on the table: ≈ $${Math.round(savings).toLocaleString()} (late shipments × delay days × $${COST_PER_DELAY_DAY}/day).`);
    
    // 1. Worst average delay by carrier
    const carrierDelays = {};
    rows.forEach(row => {
        const carrier = row.carrier_name || row.Carrier || row.carrier || 'Unknown';
        const delayDays = num(row.actual_delay_days || row.DelayDays || 0);
        
        if (delayDays > 0) { // Only count actual delays
            if (!carrierDelays[carrier]) {
                carrierDelays[carrier] = { totalDelay: 0, count: 0 };
            }
            carrierDelays[carrier].totalDelay += delayDays;
            carrierDelays[carrier].count += 1;
        }
    });
    
    const worstCarrier = Object.entries(carrierDelays)
        .map(([carrier, data]) => ({
            carrier,
            avgDelay: data.totalDelay / data.count,
            count: data.count
        }))
        .sort((a, b) => b.avgDelay - a.avgDelay)[0];
    
    if (worstCarrier && worstCarrier.count >= 2) { // Only show if at least 2 delayed shipments
        insights.push(`Carrier ${worstCarrier.carrier} has the highest average delay at ${worstCarrier.avgDelay.toFixed(1)} days (n=${worstCarrier.count}).`);
    }
    
    // 2. On-time rate (reuse KPI calculation)
    const onTimeRows = rows.filter(row => {
        const delayDays = num(row.actual_delay_days || row.DelayDays || 0);
        return delayDays <= 0;
    });
    const onTimeRate = ((onTimeRows.length / rows.length) * 100).toFixed(1);
    insights.push(`On-time performance is ${onTimeRate}% across ${rows.length} shipments.`);
    
    // 3. Risk mix (reuse risk distribution data)
    const riskCounts = {};
    rows.forEach(row => {
        const riskLevel = row.risk_level || row.RiskLevel || row.risk || row.ai_risk_score || 'Unknown';
        
        // Normalize risk level (reuse logic from risk chart)
        let normalizedRisk = 'Unknown';
        if (typeof riskLevel === 'string') {
            const lowerRisk = riskLevel.toLowerCase();
            if (lowerRisk.includes('low') || lowerRisk === 'l') {
                normalizedRisk = 'Low';
            } else if (lowerRisk.includes('medium') || lowerRisk.includes('med') || lowerRisk === 'm') {
                normalizedRisk = 'Medium';
            } else if (lowerRisk.includes('high') || lowerRisk === 'h') {
                normalizedRisk = 'High';
            } else if (lowerRisk.includes('critical') || lowerRisk.includes('crit')) {
                normalizedRisk = 'Critical';
            } else {
                const riskScore = num(riskLevel);
                if (!isNaN(riskScore)) {
                    if (riskScore <= 0.3) {
                        normalizedRisk = 'Low';
                    } else if (riskScore <= 0.6) {
                        normalizedRisk = 'Medium';
                    } else if (riskScore <= 0.8) {
                        normalizedRisk = 'High';
                    } else {
                        normalizedRisk = 'Critical';
                    }
                }
            }
        } else if (typeof riskLevel === 'number') {
            if (riskLevel <= 0.3) {
                normalizedRisk = 'Low';
            } else if (riskLevel <= 0.6) {
                normalizedRisk = 'Medium';
            } else if (riskLevel <= 0.8) {
                normalizedRisk = 'High';
            } else {
                normalizedRisk = 'Critical';
            }
        }
        
        riskCounts[normalizedRisk] = (riskCounts[normalizedRisk] || 0) + 1;
    });
    
    const highRiskCount = (riskCounts['High'] || 0) + (riskCounts['Critical'] || 0);
    const highRiskPercent = ((highRiskCount / rows.length) * 100).toFixed(1);
    if (highRiskCount > 0) {
        insights.push(`High/Critical risk accounts for ${highRiskPercent}% of shipments.`);
    }
    
    // 4. Cost-distance correlation
    const validPoints = rows.map(row => {
        const distance = num(row.route_distance_km || row.distance_km || row.DistanceKm || 0);
        const cost = num(row.cost_usd || row.CostUSD || row.cost || 0);
        return { distance, cost };
    }).filter(point => point.distance > 0 && point.cost > 0);
    
    if (validPoints.length >= 3) {
        const correlation = calculatePearsonCorrelation(validPoints);
        if (Math.abs(correlation) >= 0.3) {
            const strength = Math.abs(correlation) >= 0.7 ? 'strong' : 'moderate';
            const direction = correlation > 0 ? 'positive' : 'negative';
            insights.push(`Cost and distance show a ${strength} ${direction} correlation (r=${correlation.toFixed(2)}).`);
        }
    }
    
    // 5. Top route by emissions
    const routeEmissions = {};
    const factors = { Air: 500, Road: 62, Rail: 22, Sea: 10 };
    
    rows.forEach(row => {
        const origin = row.origin_city || row.Origin || 'Unknown';
        const destination = row.destination_city || row.Destination || 'Unknown';
        const route = `${origin} → ${destination}`;
        
        let emissionsKg = num(row.emissions_kg || row.EmissionsKg || row.carbon_emissions_kg || 0);
        
        if (emissionsKg <= 0) {
            const mode = row.transport_mode || row.mode || row.Mode || 'Road';
            const distanceKm = num(row.route_distance_km || row.distance_km || row.DistanceKm || 0);
            const weightKg = num(row.weight_kg || row.WeightKg || 0);
            const tons = weightKg > 0 ? weightKg / 1000 : 1;
            const factor = factors[mode] || factors.Road;
            emissionsKg = (distanceKm * factor * tons) / 1000;
        }
        
        routeEmissions[route] = (routeEmissions[route] || 0) + emissionsKg;
    });
    
    const topRoute = Object.entries(routeEmissions)
        .sort((a, b) => b[1] - a[1])[0];
    
    if (topRoute) {
        insights.push(`Route ${topRoute[0]} contributes ~${Math.round(topRoute[1]).toLocaleString()} kg CO₂ (est.).`);
    }
    
    // Render insights
    const insightsContainer = document.querySelector('#insights .space-y-4');
    console.log('Insights container found:', insightsContainer);
    console.log('Insights to render:', insights);
    
    if (insightsContainer) {
        if (insights.length > 0) {
            insightsContainer.innerHTML = insights.map(insight => 
                `<div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p class="text-gray-900 text-sm">• ${insight}</p>
                </div>`
            ).join('');
        } else {
            insightsContainer.innerHTML = `
                <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p class="text-gray-900 text-sm">• Data loaded successfully. No insights available in this sample.</p>
                </div>
            `;
        }
    } else {
        console.error('Insights container not found');
    }
    
    console.log('Insights rendered:', insights);
}

// Helper function to calculate Pearson correlation coefficient
function calculatePearsonCorrelation(points) {
    const n = points.length;
    if (n < 2) return 0;
    
    const x = points.map(p => p.distance);
    const y = points.map(p => p.cost);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

// Function to render outliers and anomalies
function renderOutliersAndAnomalies(rows) {
    if (!rows || rows.length === 0) {
        console.warn('No data available for outliers and anomalies');
        return;
    }

    const insightsContainer = document.querySelector('#insights .space-y-4');
    if (!insightsContainer) {
        console.error('Insights container not found');
        return;
    }

    const newCards = [];

    // 1. Top 5 late shipments
    const lateShipments = rows
        .map(row => {
            const delayDays = num(row.DelayDays || row.delay_days || row.delay || row.Delay || 0);
            const shipmentId = row.ID || row.id || row.Reference || row.reference || '-';
            const carrier = row.Carrier || row.carrier || 'Unknown';
            const origin = row.Origin || row.origin || row.origin_city || 'Unknown';
            const destination = row.Destination || row.destination || row.destination_city || 'Unknown';
            const lane = `${origin} → ${destination}`;

            return {
                shipmentId,
                carrier,
                lane,
                delayDays
            };
        })
        .filter(shipment => shipment.delayDays > 0)
        .sort((a, b) => b.delayDays - a.delayDays)
        .slice(0, 5);

    if (lateShipments.length > 0) {
        const tableHTML = `
            <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 class="text-sm font-medium text-gray-900 mb-3">Top ${lateShipments.length} Late Shipments</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-xs">
                        <thead>
                            <tr class="text-gray-700">
                                <th class="text-left py-1 pr-2">ID</th>
                                <th class="text-left py-1 pr-2">Carrier</th>
                                <th class="text-left py-1 pr-2">Lane</th>
                                <th class="text-right py-1">Delay d</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lateShipments.map(shipment => `
                                <tr class="border-t border-gray-200">
                                    <td class="py-1 pr-2 text-gray-900">${shipment.shipmentId}</td>
                                    <td class="py-1 pr-2 text-gray-900">${shipment.carrier}</td>
                                    <td class="py-1 pr-2 text-gray-900">${shipment.lane}</td>
                                    <td class="py-1 text-right text-gray-900 font-medium">${shipment.delayDays}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        newCards.push(tableHTML);
    }

    // 2. Weekly on-time dip analysis
    const weeklyData = {};
    const validDateRows = [];

    rows.forEach(row => {
        const dateField = row.ShipmentDate || row.shipment_date || row.Date || row.date;
        if (dateField) {
            const parsedDate = dayjs(dateField);
            if (parsedDate.isValid()) {
                const weekKey = parsedDate.format('GGGG-[W]WW');
                const delayDays = num(row.DelayDays || row.delay_days || row.delay || row.Delay || 0);
                
                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = { total: 0, onTime: 0 };
                }
                weeklyData[weekKey].total += 1;
                if (delayDays <= 0) {
                    weeklyData[weekKey].onTime += 1;
                }
                
                validDateRows.push({ weekKey, delayDays });
            }
        }
    });

    if (Object.keys(weeklyData).length > 0) {
        // Calculate on-time percentages for each week
        const weeklyStats = Object.entries(weeklyData)
            .map(([week, data]) => ({
                week,
                onTimePct: (data.onTime / data.total) * 100,
                count: data.total
            }))
            .sort((a, b) => a.week.localeCompare(b.week));

        // Find lowest on-time week
        const lowestWeek = weeklyStats.reduce((min, current) => 
            current.onTimePct < min.onTimePct ? current : min
        );

        // Find largest week-over-week drop
        let largestDrop = null;
        for (let i = 1; i < weeklyStats.length; i++) {
            const current = weeklyStats[i];
            const previous = weeklyStats[i - 1];
            const delta = current.onTimePct - previous.onTimePct;
            
            if (delta < 0 && (!largestDrop || delta < largestDrop.delta)) {
                largestDrop = {
                    delta,
                    week: current.week,
                    pct: current.onTimePct,
                    count: current.count
                };
            }
        }

        const weeklyInsights = [];
        
        if (lowestWeek && lowestWeek.onTimePct < 100) {
            weeklyInsights.push(`On-time rate dipped to ${lowestWeek.onTimePct.toFixed(1)}% in ${lowestWeek.week} (n=${lowestWeek.count}).`);
        }
        
        if (largestDrop) {
            weeklyInsights.push(`Largest WoW drop: ${Math.abs(largestDrop.delta).toFixed(1)} pts in ${largestDrop.week}.`);
        }

        if (weeklyInsights.length > 0) {
            const weeklyHTML = `
                <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 class="text-sm font-medium text-gray-900 mb-2">Weekly Performance</h4>
                    ${weeklyInsights.map(insight => 
                        `<p class="text-gray-900 text-sm">• ${insight}</p>`
                    ).join('')}
                </div>
            `;
            newCards.push(weeklyHTML);
        }
    }

    // Insert new cards at the top of insights
    if (newCards.length > 0) {
        const existingContent = insightsContainer.innerHTML;
        insightsContainer.innerHTML = newCards.join('') + existingContent;
    }

    console.log('Outliers and anomalies rendered:', {
        lateShipments: lateShipments.length,
        weeklyWeeks: Object.keys(weeklyData).length
    });
}

// Function to load Excel file and parse it
async function loadExcel(url) {
    try {
        // Show loading spinner
        const fileHint = document.getElementById('fileHint');
        fileHint.innerHTML = `
            <div class="bg-white backdrop-blur-md border border-gray-200 rounded-xl p-6 shadow-lg">
                <div class="flex items-center space-x-3">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                    <p class="text-gray-900 text-sm font-medium">Loading freight data...</p>
                </div>
            </div>
        `;

        // Fetch the Excel file as an ArrayBuffer
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Read the Excel file using XLSX
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON array
        const rows = XLSX.utils.sheet_to_json(worksheet);

        // Hide loading spinner and show success message with tour button
        fileHint.innerHTML = `
            <div class="bg-white backdrop-blur-md border border-gray-200 rounded-xl p-6 shadow-lg">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <div>
                            <p class="text-gray-900 text-sm font-medium">✅ Successfully loaded ${rows.length} freight records</p>
                            <p class="text-gray-600 text-xs">Ready for analysis!</p>
                        </div>
                    </div>
                    <button id="walkthrough-start-success" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 animate-pulse">
                        <div class="flex items-center space-x-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="font-semibold">Start Tour</span>
                        </div>
                    </button>
                </div>
            </div>
        `;

        // Log the first 3 rows
        console.log('First 3 rows of freight data:');
        console.log(rows.slice(0, 3));

        // Compute and update KPIs
        updateKPIs(rows);

        // Create delay by carrier chart
        createDelayByCarrierChart(rows);

        // Create risk distribution chart
        createRiskDistributionChart(rows);

        // Create cost vs distance scatter chart
        createCostDistanceChart(rows);

        // Create data preview table
        createDataPreviewTable(rows);

        // Create mode vs emissions chart and get total emissions
        const totalEmissions = createModeEmissionsChart(rows);
        
        // Update CO₂ KPI with total emissions
        if (totalEmissions > 0) {
            document.getElementById('kpi-co2').textContent = `${Math.round(totalEmissions).toLocaleString()} kg`;
        }

        // Render AI insights
        renderInsights(rows);

        // Render outliers and anomalies
        renderOutliersAndAnomalies(rows);

        // Add event listener for success message tour button
        setTimeout(() => {
            const successTourBtn = document.getElementById('walkthrough-start-success');
            if (successTourBtn) {
                successTourBtn.addEventListener('click', () => {
                    walkthrough.start();
                });
            }
        }, 100);

        return rows;
    } catch (error) {
        console.error('Error loading Excel file:', error);
        
        // Show error message
        const fileHint = document.getElementById('fileHint');
        fileHint.innerHTML = `
            <div class="bg-white backdrop-blur-md border border-gray-200 rounded-xl p-6 shadow-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                    <p class="text-gray-900 text-sm font-medium">❌ Error loading freight data: ${error.message}</p>
                </div>
            </div>
        `;
        
        return null;
    }
}

// Function to show welcome message
function showWelcomeMessage() {
    const welcomePopup = document.createElement('div');
    welcomePopup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    welcomePopup.innerHTML = `
        <div class="bg-white backdrop-blur-md rounded-xl shadow-xl max-w-md mx-4 p-6 transform transition-all border border-gray-200">
            <div class="flex items-center mb-4">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-3">
                    <h3 class="text-lg font-semibold text-gray-900">Welcome to Derya AI Freight!</h3>
                </div>
            </div>
            <div class="mb-6">
                <p class="text-sm text-gray-700 mb-4">
                    🚀 Your freight data has been loaded and analyzed! 
                </p>
                <p class="text-sm text-gray-700">
                    Take a guided tour to learn about all the features and insights available in your dashboard.
                </p>
            </div>
            <div class="flex justify-between">
                <button id="skip-welcome" class="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                    Skip Tour
                </button>
                <button id="start-walkthrough" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200">
                    Start Tour
                </button>
            </div>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(welcomePopup);
    
    // Add event listeners
    const skipBtn = welcomePopup.querySelector('#skip-welcome');
    const startBtn = welcomePopup.querySelector('#start-walkthrough');
    
    const closeWelcome = () => {
        document.body.removeChild(welcomePopup);
    };
    
    skipBtn.addEventListener('click', closeWelcome);
    startBtn.addEventListener('click', () => {
        closeWelcome();
        walkthrough.start();
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeWelcome();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Function to show demo message
function showDemoMessage() {
    // Create a Tailwind-styled popup
    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    popup.innerHTML = `
        <div class="bg-white backdrop-blur-md rounded-xl shadow-xl max-w-md mx-4 p-6 transform transition-all border border-gray-200">
            <div class="flex items-center mb-4">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-3">
                    <h3 class="text-lg font-semibold text-gray-900">Demo Mode</h3>
                </div>
            </div>
            <div class="mb-6">
                <p class="text-sm text-gray-700">
                    ✨ This is a demo :) The sample dataset will be used automatically.
                </p>
            </div>
            <div class="flex justify-end">
                <button id="close-demo-popup" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200">
                    Got it!
                </button>
            </div>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(popup);
    
    // Add close functionality
    const closeBtn = popup.querySelector('#close-demo-popup');
    const closePopup = () => {
        document.body.removeChild(popup);
    };
    
    closeBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            closePopup();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closePopup();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Walkthrough system
class WalkthroughSystem {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                title: "Welcome to Derya AI Freight",
                description: "This dashboard helps you analyze freight data and identify optimization opportunities. Let's start by exploring the data upload feature.",
                target: "#btn-upload",
                action: () => this.highlightElement("#btn-upload"),
                icon: "upload"
            },
            {
                title: "Data Loading",
                description: "Click 'Upload Data' to load your freight dataset. The system will automatically process and analyze your data.",
                target: "#btn-upload",
                action: () => this.simulateDataUpload(),
                icon: "database"
            },
            {
                title: "Filter Panel",
                description: "Use these filters to narrow down your analysis by date range, carrier, transport mode, and risk level. Let me show you how they work.",
                target: "#filters",
                action: () => {
                    this.highlightElement("#filters");
                    this.populateFilters();
                },
                icon: "filter"
            },
            {
                title: "Interactive Filters",
                description: "Watch as I demonstrate filter interactions. You can select specific carriers, modes, and risk levels to focus your analysis.",
                target: "#filters",
                action: () => {
                    this.highlightElement("#filters");
                    this.simulateFilterInteraction();
                },
                icon: "filter"
            },
            {
                title: "Key Performance Indicators",
                description: "These KPIs show your freight performance at a glance: total shipments, on-time rate, average delay, savings potential, and CO₂ emissions.",
                target: "#kpis",
                action: () => this.highlightElement("#kpis"),
                icon: "chart"
            },
            {
                title: "AI Insights",
                description: "Our AI analyzes your data to provide actionable insights about performance trends, risk patterns, and optimization opportunities.",
                target: "#insights",
                action: () => this.highlightElement("#insights"),
                icon: "lightbulb"
            },
            {
                title: "Delay Analysis",
                description: "This chart shows average delays by carrier, helping you identify which carriers need attention.",
                target: "#chart-delay-by-carrier",
                action: () => this.highlightElement("#chart-delay-by-carrier"),
                icon: "clock"
            },
            {
                title: "Risk Distribution",
                description: "Monitor your risk profile with this doughnut chart showing the distribution of low, medium, high, and critical risk shipments.",
                target: "#chart-risk",
                action: () => this.highlightElement("#chart-risk"),
                icon: "shield"
            },
            {
                title: "Cost vs Distance Analysis",
                description: "This scatter plot reveals cost efficiency patterns. Look for outliers that might indicate optimization opportunities.",
                target: "#chart-cost-distance",
                action: () => this.highlightElement("#chart-cost-distance"),
                icon: "trending"
            },
            {
                title: "Emissions Tracking",
                description: "Track CO₂ emissions by transport mode to support your sustainability goals and identify greener alternatives.",
                target: "#chart-mode-emissions",
                action: () => this.highlightElement("#chart-mode-emissions"),
                icon: "leaf"
            },
            {
                title: "Data Preview",
                description: "Review your raw data in this table. You can see all shipments with their key attributes and performance metrics.",
                target: "#table-container",
                action: () => this.highlightElement("#table-container"),
                icon: "table"
            }
        ];
        this.isActive = false;
        this.originalData = null;
    }

    start() {
        this.isActive = true;
        this.currentStep = 0;
        document.getElementById('walkthrough-overlay').classList.remove('hidden');
        this.updateStep();
    }

    stop() {
        this.isActive = false;
        document.getElementById('walkthrough-overlay').classList.add('hidden');
        this.removeSpotlight();
    }

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateStep();
        } else {
            this.stop();
        }
    }

    previous() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStep();
        }
    }

    updateStep() {
        const step = this.steps[this.currentStep];
        const overlay = document.getElementById('walkthrough-overlay');
        const tooltip = document.getElementById('walkthrough-tooltip');
        const title = document.getElementById('walkthrough-title');
        const description = document.getElementById('walkthrough-description');
        const stepCounter = document.getElementById('walkthrough-step');
        const progress = document.getElementById('walkthrough-progress');
        const prevBtn = document.getElementById('walkthrough-prev');
        const nextBtn = document.getElementById('walkthrough-next');

        // Update content
        title.textContent = step.title;
        description.textContent = step.description;
        stepCounter.textContent = `Step ${this.currentStep + 1} of ${this.steps.length}`;
        progress.style.width = `${((this.currentStep + 1) / this.steps.length) * 100}%`;

        // Update buttons
        prevBtn.disabled = this.currentStep === 0;
        nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next';

        // Execute step action
        if (step.action) {
            step.action();
        }

        // Update icon
        this.updateIcon(step.icon);
    }

    updateIcon(iconType) {
        const iconContainer = document.getElementById('walkthrough-icon');
        const icons = {
            upload: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>`,
            database: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>`,
            filter: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>`,
            chart: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>`,
            lightbulb: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>`,
            clock: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>`,
            shield: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>`,
            trending: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>`,
            leaf: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>`,
            table: `<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h4a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1z"></path>
            </svg>`
        };
        iconContainer.innerHTML = icons[iconType] || icons.upload;
    }

    highlightElement(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.error('Element not found:', selector);
            return;
        }

        // Blur any focused child that might affect measurements
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        const rect = element.getBoundingClientRect();
        const overlay = document.getElementById('walkthrough-overlay');
        const spotlight = document.getElementById('walkthrough-spotlight');
        const tooltip = document.getElementById('walkthrough-tooltip');

        // Ensure overlay itself is transparent; the shadow will provide the dim
        overlay.style.background = 'transparent';

        // Rectangle spotlight using box-shadow "cutout"
        const padding = 24; // tweak as you like (20–40 looks good)
        const left = Math.max(0, rect.left - padding);
        const top = Math.max(0, rect.top - padding);
        const width = Math.min(window.innerWidth, rect.width + padding * 2);
        const height = Math.min(window.innerHeight, rect.height + padding * 2);

        Object.assign(spotlight.style, {
            position: 'fixed',
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
            borderRadius: '12px',              // rounded rectangle
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', // dim everything else
            pointerEvents: 'none',
            background: 'transparent'          // no gradient
        });

        // Optional: add a thin outline to the target for emphasis
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '2px';
        element.style.borderRadius = '8px';

        // Tooltip positioning (unchanged, but recalculated after spotlight)
        const tooltipRect = tooltip.getBoundingClientRect();
        let ttLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let ttTop = rect.bottom + 20;

        if (ttLeft < 20) ttLeft = 20;
        if (ttLeft + tooltipRect.width > window.innerWidth - 20) {
            ttLeft = window.innerWidth - tooltipRect.width - 20;
        }
        if (ttTop + tooltipRect.height > window.innerHeight - 20) {
            ttTop = rect.top - tooltipRect.height - 20;
        }

        tooltip.style.left = `${ttLeft}px`;
        tooltip.style.top = `${ttTop}px`;
    }

    removeSpotlight() {
        const spotlight = document.getElementById('walkthrough-spotlight');
        const overlay = document.getElementById('walkthrough-overlay');

        // Clear spotlight box
        Object.assign(spotlight.style, {
            boxShadow: '',
            width: '0px',
            height: '0px',
            background: 'transparent'
        });

        // Restore overlay default (optional)
        overlay.style.background = 'rgba(0,0,0,0.5)';

        // Remove outlines
        document.querySelectorAll('*').forEach(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
        });
    }

    simulateDataUpload() {
        // Simulate clicking upload button
        const uploadBtn = document.getElementById('btn-upload');
        if (uploadBtn) {
            uploadBtn.click();
        }
        
        // Auto-advance after a delay to show the data loading
        setTimeout(() => {
            if (this.isActive) {
                this.next();
            }
        }, 2000);
    }

    populateFilters() {
        // Populate filter dropdowns with demo data
        const carrierSelect = document.querySelector('#filters select:nth-of-type(1)');
        const modeSelect = document.querySelector('#filters select:nth-of-type(2)');
        const riskSelect = document.querySelector('#filters select:nth-of-type(3)');
        
        if (carrierSelect) {
            carrierSelect.innerHTML = `
                <option class="bg-white text-gray-900">All Carriers</option>
                <option class="bg-white text-gray-900">FedEx</option>
                <option class="bg-white text-gray-900">UPS</option>
                <option class="bg-white text-gray-900">DHL</option>
                <option class="bg-white text-gray-900">TNT</option>
            `;
        }
        
        if (modeSelect) {
            modeSelect.innerHTML = `
                <option class="bg-white text-gray-900">All Modes</option>
                <option class="bg-white text-gray-900">Air</option>
                <option class="bg-white text-gray-900">Road</option>
                <option class="bg-white text-gray-900">Rail</option>
                <option class="bg-white text-gray-900">Sea</option>
            `;
        }
        
        if (riskSelect) {
            riskSelect.innerHTML = `
                <option class="bg-white text-gray-900">All Risk Levels</option>
                <option class="bg-white text-gray-900">Low</option>
                <option class="bg-white text-gray-900">Medium</option>
                <option class="bg-white text-gray-900">High</option>
                <option class="bg-white text-gray-900">Critical</option>
            `;
        }
    }

    simulateFilterInteraction() {
        // Simulate user interacting with filters
        const carrierSelect = document.querySelector('#filters select:nth-of-type(1)');
        const modeSelect = document.querySelector('#filters select:nth-of-type(2)');
        
        if (carrierSelect) {
            // Simulate selecting a carrier
            setTimeout(() => {
                carrierSelect.value = 'FedEx';
                carrierSelect.dispatchEvent(new Event('change'));
            }, 500);
        }
        
        if (modeSelect) {
            // Simulate selecting a mode
            setTimeout(() => {
                modeSelect.value = 'Air';
                modeSelect.dispatchEvent(new Event('change'));
            }, 1000);
        }
    }

    addInteractiveDemo() {
        // Add click handlers to demonstrate interactivity
        const kpiCards = document.querySelectorAll('#kpis > div');
        kpiCards.forEach((card, index) => {
            card.addEventListener('click', () => {
                if (this.isActive) {
                    // Add a subtle animation to show interactivity
                    card.style.transform = 'scale(1.02)';
                    card.style.transition = 'transform 0.2s ease';
                    setTimeout(() => {
                        card.style.transform = 'scale(1)';
                    }, 200);
                }
            });
        });
    }
}

// Initialize walkthrough system
const walkthrough = new WalkthroughSystem();

// Load Excel data when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Load the sample dataset automatically
    loadExcel('./data/Sample_Freight_Dataset.xlsx');
    
    // Show welcome message after data loads
    setTimeout(() => {
        showWelcomeMessage();
    }, 3000);
    
    // Override Upload Data button behavior
    const uploadBtn = document.getElementById('btn-upload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default behavior
            e.stopPropagation(); // Stop event bubbling
            showDemoMessage();
        });
    }

    // Walkthrough event listeners
    document.getElementById('walkthrough-start').addEventListener('click', () => {
        walkthrough.start();
    });

    // Add event listener for header tour button
    document.getElementById('walkthrough-start-header').addEventListener('click', () => {
        walkthrough.start();
    });

    document.getElementById('walkthrough-next').addEventListener('click', () => {
        walkthrough.next();
    });

    document.getElementById('walkthrough-prev').addEventListener('click', () => {
        walkthrough.previous();
    });

    document.getElementById('walkthrough-skip').addEventListener('click', () => {
        walkthrough.stop();
    });

    // Keyboard navigation for walkthrough
    document.addEventListener('keydown', (e) => {
        if (walkthrough.isActive) {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                walkthrough.next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                walkthrough.previous();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                walkthrough.stop();
            }
        }
    });
});
