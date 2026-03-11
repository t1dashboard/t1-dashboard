/**
 * Swiss Rationalism: Schedule Adherence tab showing monthly pie charts of
 * reasons why locked work orders were not completed on time.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getScheduleAdherence, getScheduleAdherenceSummary, AdherenceRecord, AdherenceSummary } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const REASON_COLORS: Record<string, string> = {
  "Vendor not Available": "#5b8a72",   // muted teal
  "Vendor Not Prepared": "#3d7a5f",   // darker teal
  "Missing Parts/Tools": "#c2785c",    // warm terracotta
  "Resource Availability": "#6b8cae",  // steel blue
  "Weather": "#8b7bb5",               // soft purple
  "XFN Partner Request": "#c4a35a",   // muted gold
  "Risk Mitigation": "#d4726a",       // muted coral
  "Pull Work Forward": "#7aa3cc",      // sky blue
};

const ALL_REASONS = [
  "Vendor not Available",
  "Vendor Not Prepared",
  "Missing Parts/Tools",
  "Resource Availability",
  "Weather",
  "XFN Partner Request",
  "Risk Mitigation",
  "Pull Work Forward",
];

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

interface MonthData {
  month: string;
  reasons: { name: string; value: number; percentage: string }[];
  total: number;
}

interface QuarterData {
  quarter: string;
  label: string;
  reasons: { name: string; value: number; percentage: string }[];
  total: number;
}

function getQuarterLabel(quarterKey: string): string {
  const [year, q] = quarterKey.split("-Q");
  return `Q${q} ${year}`;
}

function getQuarterKey(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const m = parseInt(month, 10);
  const q = Math.ceil(m / 3);
  return `${year}-Q${q}`;
}

export default function ScheduleAdherenceTab() {
  const [summary, setSummary] = useState<AdherenceSummary[]>([]);
  const [allRecords, setAllRecords] = useState<AdherenceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, records] = await Promise.all([
          getScheduleAdherenceSummary(),
          getScheduleAdherence(),
        ]);
        setSummary(summaryData);
        setAllRecords(records);
      } catch (error) {
        console.error("Error loading adherence data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const monthlyData: MonthData[] = useMemo(() => {
    // Group summary by month
    const monthMap = new Map<string, Map<string, number>>();
    
    summary.forEach(row => {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, new Map());
      }
      monthMap.get(row.month)!.set(row.reason, Number(row.count));
    });

    // Sort months descending (newest first)
    const months = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

    return months.map(month => {
      const reasonMap = monthMap.get(month)!;
      const total = Array.from(reasonMap.values()).reduce((sum, v) => sum + v, 0);
      
      const reasons = ALL_REASONS
        .filter(reason => reasonMap.has(reason))
        .map(reason => {
          const value = reasonMap.get(reason) || 0;
          return {
            name: reason,
            value,
            percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
          };
        });

      return { month, reasons, total };
    });
  }, [summary]);

  // Quarterly data
  const quarterlyData: QuarterData[] = useMemo(() => {
    const quarterMap = new Map<string, Map<string, number>>();

    summary.forEach(row => {
      const qKey = getQuarterKey(row.month);
      if (!quarterMap.has(qKey)) {
        quarterMap.set(qKey, new Map());
      }
      const reasonMap = quarterMap.get(qKey)!;
      reasonMap.set(row.reason, (reasonMap.get(row.reason) || 0) + Number(row.count));
    });

    const quarters = Array.from(quarterMap.keys()).sort((a, b) => b.localeCompare(a));

    return quarters.map(qKey => {
      const reasonMap = quarterMap.get(qKey)!;
      const total = Array.from(reasonMap.values()).reduce((sum, v) => sum + v, 0);

      const reasons = ALL_REASONS
        .filter(reason => reasonMap.has(reason))
        .map(reason => {
          const value = reasonMap.get(reason) || 0;
          return {
            name: reason,
            value,
            percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
          };
        });

      return { quarter: qKey, label: getQuarterLabel(qKey), reasons, total };
    });
  }, [summary]);

  // Overall totals across all months
  const overallTotals = useMemo(() => {
    const totals = new Map<string, number>();
    let grandTotal = 0;
    
    summary.forEach(row => {
      const count = Number(row.count);
      totals.set(row.reason, (totals.get(row.reason) || 0) + count);
      grandTotal += count;
    });

    return {
      reasons: ALL_REASONS
        .filter(reason => totals.has(reason))
        .map(reason => ({
          name: reason,
          value: totals.get(reason) || 0,
          percentage: grandTotal > 0 ? (((totals.get(reason) || 0) / grandTotal) * 100).toFixed(1) : "0.0",
        })),
      total: grandTotal,
    };
  }, [summary]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-sm px-3 py-2 shadow-sm">
          <p className="text-sm font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} work order{data.value !== 1 ? "s" : ""} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderPieChart = (data: { name: string; value: number; percentage: string }[], total: number) => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No data available
        </div>
      );
    }

    return (
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <div className="w-full lg:w-1/2" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                label={({ percentage }) => `${percentage}%`}
                labelLine={true}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={REASON_COLORS[entry.name] || "#888"} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full lg:w-1/2">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-sm font-medium text-foreground">Reason</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-foreground">Count</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.name} className="border-b border-border/50">
                  <td className="py-2 px-3 text-sm flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: REASON_COLORS[item.name] || "#888" }}
                    />
                    {item.name}
                  </td>
                  <td className="py-2 px-3 text-sm text-right font-medium">{item.value}</td>
                  <td className="py-2 px-3 text-sm text-right text-muted-foreground">{item.percentage}%</td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className="py-2 px-3 text-sm">Total</td>
                <td className="py-2 px-3 text-sm text-right">{total}</td>
                <td className="py-2 px-3 text-sm text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schedule adherence data...</p>
        </CardContent>
      </Card>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Schedule Adherence</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly breakdown of reasons why locked work orders were not completed on time
          </p>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No adherence data has been submitted yet. Use the Schedule Lock Review page to submit reasons for incomplete locked work orders.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPI */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{overallTotals.total}</div>
            <div className="text-sm text-muted-foreground mt-2">Total Incomplete Work Orders Tracked</div>
            <div className="text-xs text-muted-foreground mt-1">Across {monthlyData.length} month{monthlyData.length !== 1 ? "s" : ""}</div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Breakdown */}
      {monthlyData.length > 1 && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">Overall Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Aggregated reasons across all months
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {renderPieChart(overallTotals.reasons, overallTotals.total)}
          </CardContent>
        </Card>
      )}

      {/* Quarterly Pie Charts */}
      {quarterlyData.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-foreground pt-2">Quarterly Breakdown</h2>
          {quarterlyData.map(qData => (
            <Card key={qData.quarter}>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xl font-medium">{qData.label}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {qData.total} incomplete work order{qData.total !== 1 ? "s" : ""} tracked
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                {renderPieChart(qData.reasons, qData.total)}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* Monthly Pie Charts */}
      <h2 className="text-lg font-semibold text-foreground pt-2">Monthly Breakdown</h2>
      {monthlyData.map(monthData => (
        <Card key={monthData.month}>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">{formatMonth(monthData.month)}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {monthData.total} incomplete work order{monthData.total !== 1 ? "s" : ""} tracked
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {renderPieChart(monthData.reasons, monthData.total)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
