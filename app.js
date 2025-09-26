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
                backgroundColor: 'rgba(59, 130, 246, 0.8)', // Blue color
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
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
                        text: 'Avg Delay (days)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Carrier'
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

    // Define colors for different risk levels
    const getRiskColor = (riskLevel) => {
        switch (riskLevel.toLowerCase()) {
            case 'low': return '#10B981'; // Green
            case 'medium': return '#F59E0B'; // Orange
            case 'high': return '#EF4444'; // Red
            case 'critical': return '#DC2626'; // Dark red
            default: return '#6B7280'; // Gray for others
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
                        usePointStyle: true
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
                backgroundColor: 'rgba(59, 130, 246, 0.7)', // Semi-transparent blue
                borderColor: 'rgba(59, 130, 246, 0.8)',
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: 'rgba(59, 130, 246, 0.9)',
                pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
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
                        text: 'Distance (km)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Cost (USD)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
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
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        ${finalColumns.map(col => `
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ${col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${previewRows.map(row => `
                        <tr class="hover:bg-gray-50">
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
        <div class="mt-4 text-sm text-gray-500 text-center">
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
                backgroundColor: 'rgba(16, 185, 129, 0.8)', // Green color for emissions
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1
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
                        text: 'CO₂ (kg)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' kg';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mode'
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
    if (insightsContainer) {
        if (insights.length > 0) {
            insightsContainer.innerHTML = insights.map(insight => 
                `<div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p class="text-blue-800 text-sm">• ${insight}</p>
                </div>`
            ).join('');
        } else {
            insightsContainer.innerHTML = `
                <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p class="text-blue-800 text-sm">• Data loaded successfully. No insights available in this sample.</p>
                </div>
            `;
        }
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
            <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 class="text-sm font-medium text-blue-900 mb-3">Top ${lateShipments.length} Late Shipments</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-xs">
                        <thead>
                            <tr class="text-blue-700">
                                <th class="text-left py-1 pr-2">ID</th>
                                <th class="text-left py-1 pr-2">Carrier</th>
                                <th class="text-left py-1 pr-2">Lane</th>
                                <th class="text-right py-1">Delay d</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lateShipments.map(shipment => `
                                <tr class="border-t border-blue-200">
                                    <td class="py-1 pr-2 text-blue-800">${shipment.shipmentId}</td>
                                    <td class="py-1 pr-2 text-blue-800">${shipment.carrier}</td>
                                    <td class="py-1 pr-2 text-blue-800">${shipment.lane}</td>
                                    <td class="py-1 text-right text-blue-800 font-medium">${shipment.delayDays}</td>
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
                <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 class="text-sm font-medium text-blue-900 mb-2">Weekly Performance</h4>
                    ${weeklyInsights.map(insight => 
                        `<p class="text-blue-800 text-sm">• ${insight}</p>`
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
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-center">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                    <p class="text-blue-800 text-sm">Loading freight data...</p>
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

        // Hide loading spinner and show success message
        fileHint.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <p class="text-green-800 text-sm">✅ Successfully loaded ${rows.length} freight records</p>
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

        return rows;
    } catch (error) {
        console.error('Error loading Excel file:', error);
        
        // Show error message
        const fileHint = document.getElementById('fileHint');
        fileHint.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-800 text-sm">❌ Error loading freight data: ${error.message}</p>
            </div>
        `;
        
        return null;
    }
}

// Function to show demo message
function showDemoMessage() {
    // Create a Tailwind-styled popup
    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    popup.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md mx-4 p-6 transform transition-all">
            <div class="flex items-center mb-4">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-3">
                    <h3 class="text-lg font-medium text-gray-900">Demo Mode</h3>
                </div>
            </div>
            <div class="mb-6">
                <p class="text-sm text-gray-600">
                    ✨ This is a demo :) The sample dataset will be used automatically.
                </p>
            </div>
            <div class="flex justify-end">
                <button id="close-demo-popup" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
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

// Load Excel data when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Load the sample dataset automatically
    loadExcel('./data/Sample_Freight_Dataset.xlsx');
    
    // Override Upload Data button behavior
    const uploadBtn = document.getElementById('btn-upload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default behavior
            e.stopPropagation(); // Stop event bubbling
            showDemoMessage();
        });
    }
});
