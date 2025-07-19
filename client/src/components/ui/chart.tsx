import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

// Define chart data interface
export interface ChartData {
  categoryScores: {
    category: string;
    score: number;
  }[];
  strengthsWeaknesses: {
    strengths: number;
    weaknesses: number;
  };
  overallQuality: number;
}

interface ChartDisplayProps {
  data: ChartData;
}

export function GradingCharts({ data }: ChartDisplayProps) {
  // Colors for charts
  const COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#0d9488', '#059669'];
  const PIE_COLORS = ['#4ade80', '#f87171'];
  
  // Convert strengths/weaknesses to pie chart format
  const strengthsWeaknessesData = [
    { name: 'Strengths', value: data.strengthsWeaknesses.strengths },
    { name: 'Weaknesses', value: data.strengthsWeaknesses.weaknesses },
  ];
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Evaluation Metrics</CardTitle>
          <CardDescription>Visual breakdown of the assignment evaluation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Category Scores Bar Chart */}
            <div>
              <h3 className="text-sm font-medium mb-2">Category Scores</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.categoryScores}
                    margin={{ top: 20, right: 10, left: 10, bottom: 30 }}
                  >
                    <XAxis 
                      dataKey="category" 
                      angle={-45} 
                      textAnchor="end"
                      height={70}
                      fontSize={12}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                    <Bar dataKey="score" fill="#4f46e5">
                      {data.categoryScores.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Two charts side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths vs Weaknesses Pie Chart */}
              <div>
                <h3 className="text-sm font-medium mb-2">Strengths vs Weaknesses</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={strengthsWeaknessesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {strengthsWeaknessesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Overall Quality Meter */}
              <div>
                <h3 className="text-sm font-medium mb-2">Overall Quality Rating</h3>
                <div className="flex flex-col items-center justify-center h-48">
                  <div className="text-5xl font-bold text-indigo-600">
                    {data.overallQuality}%
                  </div>
                  <div className="w-full mt-4 bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full ${getQualityColor(data.overallQuality)}`}
                      style={{ width: `${data.overallQuality}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    {getQualityLabel(data.overallQuality)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions to determine quality color and label
function getQualityColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 70) return 'bg-blue-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

// Function to try to extract chart data from LLM response
export function extractChartData(text: string): ChartData | null {
  try {
    // Try different JSON formats that might appear in the response
    let jsonData = null;
    
    // Format 1: Markdown code block with json tag
    const jsonBlockMatch = text.match(/```json\s*({[\s\S]*?})\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      jsonData = JSON.parse(jsonBlockMatch[1]);
    }
    
    // Format 2: Generic markdown code block
    if (!jsonData) {
      const codeBlockMatch = text.match(/```\s*({[\s\S]*?})\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          jsonData = JSON.parse(codeBlockMatch[1]);
        } catch (e) {
          // Not valid JSON, ignore this match
        }
      }
    }
    
    // Format 3: Plain json word followed by JSON object
    if (!jsonData) {
      const plainJsonMatch = text.match(/json\s*({[\s\S]*?})/);
      if (plainJsonMatch && plainJsonMatch[1]) {
        try {
          jsonData = JSON.parse(plainJsonMatch[1]);
        } catch (e) {
          // Not valid JSON, ignore this match
        }
      }
    }
    
    // Format 4: Just the raw JSON object at the end of the text
    if (!jsonData) {
      const rawJsonMatch = text.match(/{[\s\S]*?"categoryScores"[\s\S]*?}/);
      if (rawJsonMatch) {
        try {
          jsonData = JSON.parse(rawJsonMatch[0]);
        } catch (e) {
          // Not valid JSON, ignore this match
        }
      }
    }
    
    // Validate that the extracted JSON has the required structure
    if (
      jsonData && 
      jsonData.categoryScores && 
      Array.isArray(jsonData.categoryScores) && 
      jsonData.strengthsWeaknesses &&
      typeof jsonData.overallQuality === 'number'
    ) {
      return jsonData as ChartData;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting chart data:', error);
    return null;
  }
}