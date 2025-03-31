import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';

const Dashboard = ({ uploadData }) => {
  const [config, setConfig] = useState({
    xAxis: '',
    yAxis: '',
    chartType: 'bar',
    aggType: 'sum'
  });
  
  const [cardConfig, setCardConfig] = useState({
    showCard: false,
    column: '',
    aggType: 'sum',
    referenceColumn: ''
  });
  
  const [chartData, setChartData] = useState(null);
  const [cardData, setCardData] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: null });

  // Auto-select columns on data load
  useEffect(() => {
    if (uploadData?.columns) {
      setConfig({
        xAxis: uploadData.columns.all[0] || '',
        yAxis: uploadData.columns.numeric[0] || '',
        chartType: 'bar',
        aggType: 'sum'
      });
      setCardConfig({
        showCard: false,
        column: uploadData.columns.numeric[0] || '',
        aggType: 'sum',
        referenceColumn: uploadData.columns.all[0] || ''
      });
    }
  }, [uploadData]);

  // Generate chart when config changes
  useEffect(() => {
    const generateChart = async () => {
      if (!uploadData?.data || !config.xAxis || (config.chartType !== 'pie' && !config.yAxis)) return;
      
      setStatus({ loading: true, error: null });
      try {
        const payload = {
          data: uploadData.data,
          x_column: config.xAxis,
          chart_type: config.chartType
        };

        if (config.chartType !== 'pie') {
          payload.y_column = config.yAxis;
          payload.agg_type = config.aggType;
        } else {
          payload.y_column = config.yAxis; // For pie chart values
        }

        const res = await axios.post('http://localhost:8000/generate-chart', payload);
        
        if (res.data.success) {
          setChartData(JSON.parse(res.data.chart));
        } else {
          throw new Error(res.data.error || "Failed to generate chart");
        }
      } catch (err) {
        setStatus(prev => ({...prev, error: err.message}));
        setChartData(null);
      } finally {
        setStatus(prev => ({...prev, loading: false}));
      }
    };
    
    generateChart();
  }, [config, uploadData]);

  // Generate card when card config changes
  useEffect(() => {
    const generateCard = async () => {
      if (!cardConfig.showCard || !cardConfig.column || !uploadData?.data) {
        setCardData(null);
        return;
      }
      
      try {
        const payload = {
          data: uploadData.data,
          column: cardConfig.column,
          agg_type: cardConfig.aggType
        };
        
        if (['max', 'min'].includes(cardConfig.aggType)) {
          if (!cardConfig.referenceColumn) {
            throw new Error("Please select a reference column for max/min values");
          }
          payload.reference_column = cardConfig.referenceColumn;
        }
        
        const res = await axios.post('http://localhost:8000/generate-card', payload);
        
        if (res.data.success) {
          setCardData(res.data.card);
        } else {
          throw new Error(res.data.error || "Failed to generate card");
        }
      } catch (err) {
        setStatus(prev => ({...prev, error: err.message}));
        setCardData(null);
      }
    };
    
    generateCard();
  }, [cardConfig, uploadData]);

  const handleConfigChange = (key, value) => {
    setConfig(prev => {
      const newConfig = {...prev, [key]: value};
      
      // Reset y-axis if chart type doesn't need it
      if (key === 'chartType' && value === 'histogram') {
        newConfig.yAxis = '';
      }
      return newConfig;
    });
  };

  if (!uploadData) return <div>Upload a file to begin</div>;
  if (uploadData?.columns?.numeric?.length === 0) {
    return <div className="error">No numeric columns found for charts.</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="controls-grid">
        {/* Chart Controls */}
        <div className="control-section">
          <h3>Chart Configuration</h3>
          <div className="control-group">
            <label>
              {config.chartType === 'pie' ? 'Categories:' : 'X-Axis:'}
            </label>
            <select
              value={config.xAxis}
              onChange={(e) => handleConfigChange('xAxis', e.target.value)}
            >
              {uploadData.columns.all.map(col => (
                <option key={`x-${col}`} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {config.chartType !== 'pie' && (
            <div className="control-group">
              <label>
                {config.chartType === 'histogram' ? 'Values:' : 'Y-Axis:'}
              </label>
              <select
                value={config.yAxis}
                onChange={(e) => handleConfigChange('yAxis', e.target.value)}
                disabled={config.chartType === 'histogram'}
              >
                {uploadData.columns.numeric.map(col => (
                  <option key={`y-${col}`} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          {config.chartType === 'pie' && (
            <div className="control-group">
              <label>Values:</label>
              <select
                value={config.yAxis}
                onChange={(e) => handleConfigChange('yAxis', e.target.value)}
              >
                {uploadData.columns.numeric.map(col => (
                  <option key={`y-${col}`} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          <div className="control-group">
            <label>Chart Type:</label>
            <select
              value={config.chartType}
              onChange={(e) => handleConfigChange('chartType', e.target.value)}
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="scatter">Scatter Plot</option>
              <option value="area">Area Chart</option>
              <option value="histogram">Histogram</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>

          {config.chartType !== 'pie' && config.chartType !== 'histogram' && (
            <div className="control-group">
              <label>Aggregation:</label>
              <select
                value={config.aggType}
                onChange={(e) => handleConfigChange('aggType', e.target.value)}
              >
                <option value="sum">Sum</option>
                <option value="count">Count</option>
                <option value="average">Average</option>
                <option value="distinct_count">Distinct Count</option>
              </select>
            </div>
          )}
        </div>

        {/* Card Controls */}
        <div className="control-section">
          <h3>Card Configuration</h3>
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={cardConfig.showCard}
                onChange={(e) => setCardConfig({
                  ...cardConfig,
                  showCard: e.target.checked
                })}
              />
              Enable Card
            </label>
          </div>

          {cardConfig.showCard && (
            <>
              <div className="control-group">
                <label>Metric Column:</label>
                <select
                  value={cardConfig.column}
                  onChange={(e) => setCardConfig({
                    ...cardConfig,
                    column: e.target.value
                  })}
                >
                  {uploadData.columns.numeric.map(col => (
                    <option key={`card-col-${col}`} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label>Metric Type:</label>
                <select
                  value={cardConfig.aggType}
                  onChange={(e) => setCardConfig({
                    ...cardConfig,
                    aggType: e.target.value
                  })}
                >
                  <option value="sum">Sum</option>
                  <option value="count">Count</option>
                  <option value="average">Average</option>
                  <option value="distinct_count">Distinct Count</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                  <option value="raw">Raw Value</option>
                </select>
              </div>

              {(cardConfig.aggType === "max" || cardConfig.aggType === "min") && (
                <div className="control-group">
                  <label>Show Value For:</label>
                  <select
                    value={cardConfig.referenceColumn}
                    onChange={(e) => setCardConfig({
                      ...cardConfig,
                      referenceColumn: e.target.value
                    })}
                  >
                    <option value="">Select a column</option>
                    {uploadData.columns.all.map(col => (
                      <option key={`ref-${col}`} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {status.loading && <div className="status">Generating visuals...</div>}
      {status.error && (
        <div className="error">
          {status.error}
          {status.error.includes("reference column") && cardConfig.showCard && (
            <select
              value={cardConfig.referenceColumn}
              onChange={(e) => setCardConfig({
                ...cardConfig,
                referenceColumn: e.target.value
              })}
              style={{ marginTop: '10px', width: '100%' }}
            >
              <option value="">Select a column</option>
              {uploadData.columns.all.map(col => (
                <option key={`fix-ref-${col}`} value={col}>{col}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Card Display */}
      {cardConfig.showCard && (
        <div className="card-container">
          {cardData ? (
            <div className="card-visual">
              <h4>{cardData.title}</h4>
              <div className="card-value">{cardData.value}</div>
              {cardData.metadata?.reference_value && (
                <div className="card-reference">
                  {cardConfig.referenceColumn}: {cardData.metadata.reference_value}
                </div>
              )}
            </div>
          ) : !status.error && (
            <div className="status">Configure card settings above</div>
          )}
        </div>
      )}

      {/* Chart Display */}
      <div className="chart-container">
        {chartData ? (
          <Plot
            data={chartData.data}
            layout={{
              ...chartData.layout,
              autosize: true,
              margin: { t: 40, pad: 4 }
            }}
            useResizeHandler
            style={{ width: '100%', height: '500px' }}
          />
        ) : (
          <div className="status">No chart data available</div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;