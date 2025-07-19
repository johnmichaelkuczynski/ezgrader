import React from 'react';

export interface GraphData {
  title: string;
  type: 'line' | 'bar' | 'scatter' | 'area' | 'pie';
  data: Array<{
    x: number | string;
    y: number;
    label?: string;
  }>;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  width?: number;
  height?: number;
}

interface GraphGeneratorProps {
  graphData: GraphData;
  className?: string;
}

export const GraphGenerator: React.FC<GraphGeneratorProps> = ({ 
  graphData, 
  className = '' 
}) => {
  const { 
    title, 
    type, 
    data, 
    xLabel = '', 
    yLabel = '', 
    color = '#3b82f6',
    width = 600,
    height = 400
  } = graphData;

  const margin = { top: 60, right: 30, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Calculate scales
  const xValues = data.map(d => typeof d.x === 'number' ? d.x : data.indexOf(d));
  const yValues = data.map(d => d.y);
  
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(0, Math.min(...yValues));
  const yMax = Math.max(...yValues);

  const xScale = (value: number) => (value - xMin) / (xMax - xMin) * chartWidth;
  const yScale = (value: number) => chartHeight - (value - yMin) / (yMax - yMin) * chartHeight;

  const renderLineChart = () => {
    const points = data.map((d, i) => `${xScale(xValues[i])},${yScale(d.y)}`).join(' ');
    
    return (
      <g>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(xValues[i])}
            cy={yScale(d.y)}
            r="4"
            fill={color}
          />
        ))}
      </g>
    );
  };

  const renderBarChart = () => {
    const barWidth = chartWidth / data.length * 0.8;
    
    return (
      <g>
        {data.map((d, i) => (
          <rect
            key={i}
            x={xScale(xValues[i]) - barWidth / 2}
            y={yScale(d.y)}
            width={barWidth}
            height={yScale(yMin) - yScale(d.y)}
            fill={color}
            opacity="0.8"
          />
        ))}
      </g>
    );
  };

  const renderScatterChart = () => {
    return (
      <g>
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(xValues[i])}
            cy={yScale(d.y)}
            r="6"
            fill={color}
            opacity="0.7"
          />
        ))}
      </g>
    );
  };

  const renderAreaChart = () => {
    const points = data.map((d, i) => `${xScale(xValues[i])},${yScale(d.y)}`).join(' ');
    const areaPoints = `${xScale(xValues[0])},${yScale(yMin)} ${points} ${xScale(xValues[xValues.length - 1])},${yScale(yMin)}`;
    
    return (
      <g>
        <polygon points={areaPoints} fill={color} opacity="0.3" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      </g>
    );
  };

  const renderPieChart = () => {
    const total = data.reduce((sum, d) => sum + d.y, 0);
    let currentAngle = 0;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 20;
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;

    return (
      <g>
        {data.map((d, i) => {
          const sliceAngle = (d.y / total) * 2 * Math.PI;
          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceAngle;
          
          const x1 = centerX + radius * Math.cos(startAngle);
          const y1 = centerY + radius * Math.sin(startAngle);
          const x2 = centerX + radius * Math.cos(endAngle);
          const y2 = centerY + radius * Math.sin(endAngle);
          
          const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
          
          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
          ].join(' ');
          
          currentAngle += sliceAngle;
          
          return (
            <path
              key={i}
              d={pathData}
              fill={`hsl(${(i * 360) / data.length}, 70%, 50%)`}
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
      </g>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'line': return renderLineChart();
      case 'bar': return renderBarChart();
      case 'scatter': return renderScatterChart();
      case 'area': return renderAreaChart();
      case 'pie': return renderPieChart();
      default: return renderLineChart();
    }
  };

  const renderAxes = () => {
    if (type === 'pie') return null;

    // Generate tick marks
    const xTicks = 5;
    const yTicks = 5;
    
    return (
      <g>
        {/* X-axis */}
        <line
          x1={0}
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="#666"
          strokeWidth="1"
        />
        
        {/* Y-axis */}
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={chartHeight}
          stroke="#666"
          strokeWidth="1"
        />
        
        {/* X-axis ticks and labels */}
        {Array.from({ length: xTicks }, (_, i) => {
          const value = xMin + (xMax - xMin) * i / (xTicks - 1);
          const x = xScale(value);
          return (
            <g key={`x-${i}`}>
              <line x1={x} y1={chartHeight} x2={x} y2={chartHeight + 5} stroke="#666" />
              <text x={x} y={chartHeight + 20} textAnchor="middle" fontSize="12" fill="#666">
                {typeof data[0]?.x === 'string' ? data[Math.floor(value)]?.x || value.toFixed(0) : value.toFixed(1)}
              </text>
            </g>
          );
        })}
        
        {/* Y-axis ticks and labels */}
        {Array.from({ length: yTicks }, (_, i) => {
          const value = yMin + (yMax - yMin) * i / (yTicks - 1);
          const y = yScale(value);
          return (
            <g key={`y-${i}`}>
              <line x1={-5} y1={y} x2={0} y2={y} stroke="#666" />
              <text x={-10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                {value.toFixed(1)}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div className={`graph-container ${className}`}>
      <svg width={width} height={height} className="border rounded-lg bg-white">
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {renderAxes()}
          {renderChart()}
        </g>
        
        {/* Title */}
        <text
          x={width / 2}
          y={30}
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill="#333"
        >
          {title}
        </text>
        
        {/* Axis labels */}
        {type !== 'pie' && (
          <>
            <text
              x={width / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="14"
              fill="#666"
            >
              {xLabel}
            </text>
            <text
              x={20}
              y={height / 2}
              textAnchor="middle"
              fontSize="14"
              fill="#666"
              transform={`rotate(-90, 20, ${height / 2})`}
            >
              {yLabel}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

export default GraphGenerator;