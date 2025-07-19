import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

interface CategoryScore {
  category: string;
  student1Score: number;
  student2Score: number;
  explanation?: string;
  [key: string]: any;
}

interface StrengthsWeaknesses {
  student1: {
    strengths: number;
    weaknesses: number;
    explanation?: string;
  };
  student2: {
    strengths: number;
    weaknesses: number;
    explanation?: string;
  };
}

interface ComparisonData {
  categoryScores: CategoryScore[];
  strengthsWeaknesses: StrengthsWeaknesses;
  overallScores: {
    student1: number;
    student2: number;
    explanation?: string;
  };
  requirementsFulfillment: {
    category: string;
    student1: number;
    student2: number;
    explanation?: string;
    [key: string]: any;
  }[];
  qualityMetrics: {
    metric: string;
    student1: number;
    student2: number;
    explanation?: string;
    [key: string]: any;
  }[];
}

interface ComparisonChartProps {
  data: ComparisonData;
  student1Name: string;
  student2Name: string;
}

const COLORS = {
  student1: ['#0088FE', '#3366CC', '#0047AB', '#4682B4', '#1F75FE'],
  student2: ['#8884d8', '#9370DB', '#8A2BE2', '#9932CC', '#BA55D3']
};

export const ComparisonChart = ({ data, student1Name, student2Name }: ComparisonChartProps) => {
  const truncateName = (name: string, maxLength = 15) => {
    return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
  };

  // Format data for the pie charts
  const strengthsWeaknessesStudent1 = [
    { name: 'Strengths', value: data.strengthsWeaknesses.student1.strengths, fill: '#0088FE' },
    { name: 'Areas for Improvement', value: data.strengthsWeaknesses.student1.weaknesses, fill: '#00C49F' }
  ];
  
  const strengthsWeaknessesStudent2 = [
    { name: 'Strengths', value: data.strengthsWeaknesses.student2.strengths, fill: '#8884d8' },
    { name: 'Areas for Improvement', value: data.strengthsWeaknesses.student2.weaknesses, fill: '#00C49F' }
  ];

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'student1Score' 
                ? `${truncateName(student1Name)}: ${entry.value}` 
                : `${truncateName(student2Name)}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-12">
      {/* Overall Comparison */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">Overall Performance Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { 
                    name: 'Overall Score', 
                    [truncateName(student1Name)]: data.overallScores.student1,
                    [truncateName(student2Name)]: data.overallScores.student2 
                  }
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey={truncateName(student1Name)} fill="#0088FE" name={student1Name} />
                <Bar dataKey={truncateName(student2Name)} fill="#8884d8" name={student2Name} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white rounded-lg shadow p-5 border border-gray-200 flex flex-col justify-center">
            <h4 className="text-md font-semibold border-b pb-2 mb-4">Performance Summary</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <h5 className="font-medium text-blue-700 mb-1">{student1Name}</h5>
                  <div className="text-3xl font-bold text-blue-800">{data.overallScores.student1}%</div>
                  <div className="text-sm mt-2 text-blue-600 font-medium">
                    {data.overallScores.student1 >= 90 ? 'Excellent' : 
                     data.overallScores.student1 >= 80 ? 'Very Good' : 
                     data.overallScores.student1 >= 70 ? 'Good' : 
                     data.overallScores.student1 >= 60 ? 'Fair' : 'Needs Improvement'}
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <h5 className="font-medium text-purple-700 mb-1">{student2Name}</h5>
                  <div className="text-3xl font-bold text-purple-800">{data.overallScores.student2}%</div>
                  <div className="text-sm mt-2 text-purple-600 font-medium">
                    {data.overallScores.student2 >= 90 ? 'Excellent' : 
                     data.overallScores.student2 >= 80 ? 'Very Good' : 
                     data.overallScores.student2 >= 70 ? 'Good' : 
                     data.overallScores.student2 >= 60 ? 'Fair' : 'Needs Improvement'}
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded bg-gray-50 border border-gray-200 mt-4">
                <h5 className="text-sm font-medium mb-2">Performance Gap Analysis</h5>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Score Difference:</span>
                  <span className={`font-medium ${data.overallScores.student2 > data.overallScores.student1 ? 'text-green-600' : data.overallScores.student2 < data.overallScores.student1 ? 'text-red-600' : 'text-gray-600'}`}>
                    {Math.abs(data.overallScores.student2 - data.overallScores.student1).toFixed(1)}%
                    {data.overallScores.student2 > data.overallScores.student1 ? ' (Student 2 higher)' : 
                     data.overallScores.student2 < data.overallScores.student1 ? ' (Student 1 higher)' : ' (equal)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {data.overallScores.explanation && (
          <div className="mt-2 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h4 className="text-md font-semibold mb-3 text-gray-800 border-b pb-2">Overall Performance Detailed Analysis:</h4>
            <div 
              className="prose max-w-none text-gray-700" 
              dangerouslySetInnerHTML={{ __html: data.overallScores.explanation }}
            />
          </div>
        )}
      </div>

      {/* Category Scores */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">Performance by Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.categoryScores.map(item => ({
                  category: item.category,
                  [truncateName(student1Name)]: item.student1Score,
                  [truncateName(student2Name)]: item.student2Score
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey={truncateName(student1Name)} fill="#0088FE" name={student1Name} />
                <Bar dataKey={truncateName(student2Name)} fill="#8884d8" name={student2Name} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="p-5 bg-gray-50 rounded-lg shadow border border-gray-100 flex flex-col">
            <h4 className="text-md font-semibold border-b pb-2 mb-4">Category Performance Summary</h4>
            <div className="overflow-auto max-h-[320px] pr-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Category</th>
                    <th className="text-center p-2">{student1Name}</th>
                    <th className="text-center p-2">{student2Name}</th>
                    <th className="text-center p-2">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categoryScores.map((item, index) => {
                    const difference = item.student2Score - item.student1Score;
                    const diffColor = difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600';
                    
                    return (
                      <tr key={`cat-item-${index}`} className="border-b border-gray-200">
                        <td className="p-2 font-medium">{item.category}</td>
                        <td className="p-2 text-center bg-blue-50">{item.student1Score}%</td>
                        <td className="p-2 text-center bg-purple-50">{item.student2Score}%</td>
                        <td className={`p-2 text-center font-medium ${diffColor}`}>
                          {difference > 0 ? '+' : ''}{difference}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-sm">
                <span className="font-medium">Key Insights:</span> This chart compares performance across critical assessment categories. 
                The table shows exact scores and highlights the performance gap between students.
              </p>
            </div>
          </div>
        </div>
        
        {data.categoryScores.map((item, index) => (
          item.explanation ? (
            <div key={`category-explanation-${index}`} className="mt-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h4 className="text-md font-semibold mb-3 text-gray-800 border-b pb-2">{item.category} Detailed Analysis:</h4>
              <div 
                className="prose max-w-none text-gray-700" 
                dangerouslySetInnerHTML={{ __html: item.explanation }}
              />
            </div>
          ) : null
        ))}
      </div>

      {/* Strengths vs Weaknesses Pie Charts */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">Strengths & Areas for Improvement</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <h4 className="text-center text-blue-600 font-medium mb-3 border-b pb-2">{student1Name}</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strengthsWeaknessesStudent1}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {strengthsWeaknessesStudent1.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-sm">
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-blue-50 p-2 rounded text-center">
                  <div className="font-semibold">Strengths</div>
                  <div className="text-blue-700 text-lg font-bold">{data.strengthsWeaknesses.student1.strengths}%</div>
                </div>
                <div className="bg-green-50 p-2 rounded text-center">
                  <div className="font-semibold">Areas to Improve</div>
                  <div className="text-green-700 text-lg font-bold">{data.strengthsWeaknesses.student1.weaknesses}%</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-1 bg-gray-50 rounded-lg shadow p-4 border border-gray-200 flex flex-col justify-center">
            <h4 className="text-center font-medium mb-3 border-b pb-2">Comparative Analysis</h4>
            <div className="space-y-4">
              <div className="bg-white p-3 rounded shadow-sm">
                <div className="text-sm font-medium mb-2">Strength-to-Weakness Ratio</div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-600 font-bold">{student1Name}</span>
                  <span>{(data.strengthsWeaknesses.student1.strengths / Math.max(1, data.strengthsWeaknesses.student1.weaknesses)).toFixed(1)}:1</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-purple-600 font-bold">{student2Name}</span>
                  <span>{(data.strengthsWeaknesses.student2.strengths / Math.max(1, data.strengthsWeaknesses.student2.weaknesses)).toFixed(1)}:1</span>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded shadow-sm">
                <div className="text-sm font-medium mb-2">Balance Comparison</div>
                <div className="text-xs">
                  {data.strengthsWeaknesses.student1.strengths > data.strengthsWeaknesses.student2.strengths ? 
                    `${student1Name} demonstrates a higher ratio of strengths (${data.strengthsWeaknesses.student1.strengths}%) compared to ${student2Name} (${data.strengthsWeaknesses.student2.strengths}%).` :
                    `${student2Name} demonstrates a higher ratio of strengths (${data.strengthsWeaknesses.student2.strengths}%) compared to ${student1Name} (${data.strengthsWeaknesses.student1.strengths}%).`
                  }
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <h4 className="text-center text-purple-600 font-medium mb-3 border-b pb-2">{student2Name}</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strengthsWeaknessesStudent2}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {strengthsWeaknessesStudent2.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-sm">
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-purple-50 p-2 rounded text-center">
                  <div className="font-semibold">Strengths</div>
                  <div className="text-purple-700 text-lg font-bold">{data.strengthsWeaknesses.student2.strengths}%</div>
                </div>
                <div className="bg-green-50 p-2 rounded text-center">
                  <div className="font-semibold">Areas to Improve</div>
                  <div className="text-green-700 text-lg font-bold">{data.strengthsWeaknesses.student2.weaknesses}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {data.strengthsWeaknesses?.student1?.explanation && (
          <div className="mt-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h4 className="text-md font-semibold mb-3 text-gray-800 border-b pb-2">Strengths & Weaknesses Comparative Analysis:</h4>
            <div 
              className="prose max-w-none text-gray-700" 
              dangerouslySetInnerHTML={{ __html: data.strengthsWeaknesses.student1.explanation }}
            />
          </div>
        )}
      </div>

      {/* Requirements Fulfillment - Radar Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">Assignment Requirements Fulfillment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.requirementsFulfillment}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name={student1Name} dataKey="student1" stroke="#0088FE" fill="#0088FE" fillOpacity={0.6} />
                <Radar name={student2Name} dataKey="student2" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg shadow border border-gray-100 flex flex-col justify-center">
            <h4 className="text-md font-semibold border-b pb-2 mb-4">Requirements Score Analysis</h4>
            <ul className="space-y-3">
              {data.requirementsFulfillment.map((item, index) => (
                <li key={`req-item-${index}`} className="flex items-center justify-between">
                  <span className="font-medium">{item.category}</span>
                  <div className="flex space-x-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      {student1Name}: {item.student1}%
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                      {student2Name}: {item.student2}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium">
                This radar chart visualizes how well each student fulfilled the specific assignment requirements. 
                Higher scores (further from center) indicate better fulfillment of that requirement.
              </p>
            </div>
          </div>
        </div>
        {data.requirementsFulfillment.map((item, index) => (
          item.explanation ? (
            <div key={`requirement-explanation-${index}`} className="mt-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h4 className="text-md font-semibold mb-3 text-gray-800 border-b pb-2">{item.category} Detailed Analysis:</h4>
              <div 
                className="prose max-w-none text-gray-700" 
                dangerouslySetInnerHTML={{ __html: item.explanation }}
              />
            </div>
          ) : null
        ))}
      </div>

      {/* Quality Metrics - Area Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">Quality Metrics Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.qualityMetrics}
                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="student1" name={student1Name} stroke="#0088FE" activeDot={{ r: 8 }} strokeWidth={2} />
                <Line type="monotone" dataKey="student2" name={student2Name} stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="font-medium border-b pb-2 mb-3">Key Quality Metrics Insights</h4>
            <div className="overflow-auto max-h-[300px]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Metric</th>
                    <th className="text-center p-2 font-medium">{student1Name}</th>
                    <th className="text-center p-2 font-medium">{student2Name}</th>
                    <th className="text-center p-2 font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.qualityMetrics.map((item, index) => {
                    const difference = (item.student2 - item.student1);
                    const diffColor = difference > 5 ? 'text-green-600' : difference < -5 ? 'text-red-600' : 'text-gray-600';
                    
                    return (
                      <tr key={`quality-row-${index}`} className="border-b border-gray-100">
                        <td className="p-2 font-medium">{item.metric}</td>
                        <td className="p-2 text-center bg-blue-50">{item.student1}%</td>
                        <td className="p-2 text-center bg-purple-50">{item.student2}%</td>
                        <td className={`p-2 text-center ${diffColor}`}>
                          {difference > 0 ? '+' : ''}{difference.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
              <h5 className="font-medium mb-2">Interpretation Guide</h5>
              <ul className="space-y-1 list-disc pl-5 text-xs text-gray-700">
                <li><span className="font-medium">Line chart:</span> Shows trends across multiple quality dimensions</li>
                <li><span className="font-medium">Gap analysis:</span> Highlights significant differences between submissions</li>
                <li><span className="font-medium">Color coding:</span> Green indicates substantial positive difference, red shows areas where the first student performed better</li>
              </ul>
              <div className="mt-3 text-xs text-gray-500">
                Click on individual metrics below for detailed comparative analysis with quoted examples
              </div>
            </div>
          </div>
        </div>
        
        {data.qualityMetrics.map((item, index) => (
          item.explanation ? (
            <div key={`quality-explanation-${index}`} className="mt-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h4 className="text-md font-semibold mb-3 text-gray-800 border-b pb-2">{item.metric} Detailed Analysis:</h4>
              <div 
                className="prose max-w-none text-gray-700" 
                dangerouslySetInnerHTML={{ __html: item.explanation }}
              />
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
};