/**
 * Swiss Rationalism: Schedule Adherence tab showing monthly pie charts of
 * reasons why locked work orders were not completed on time,
 * plus adherence percentage based on reason tracking (WOs without a reason = adhered to plan).
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getScheduleAdherence, getScheduleAdherenceSummary, getScheduleAdherenceStats, AdherenceRecord, AdherenceSummary, AdherenceStats } from "@/lib/api";
import { Loader2, Download, TrendingUp, TrendingDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";

const REASON_COLORS: Record<string, string> = {
  "Vendor not Available": "#5b8a72",   // muted teal
  "Vendor Not Prepared": "#3d7a5f",   // darker teal
  "Missing Parts/Tools": "#c2785c",    // warm terracotta
  "Resource Availability": "#6b8cae",  // steel blue
  "Weather": "#8b7bb5",               // soft purple
  "XFN Partner Request": "#c4a35a",   // muted gold
  "Risk Mitigation": "#d4726a",       // muted coral
  "Completed Early": "#7aa3cc",      // sky blue
  "SOW Changed": "#b07cc6",              // soft purple
};

const ALL_REASONS = [
  "Vendor not Available",
  "Vendor Not Prepared",
  "Missing Parts/Tools",
  "Resource Availability",
  "Weather",
  "XFN Partner Request",
  "Risk Mitigation",
  "Completed Early",
  "SOW Changed",
];

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

function formatWeekRange(lockWeek: string): string {
  // lockWeek is a Monday date. The actual T1 week is the NEXT week (lockWeek + 7 days)
  const weekDate = new Date(lockWeek + "T00:00:00");
  const t1Monday = new Date(weekDate);
  t1Monday.setDate(weekDate.getDate() + 7);
  const t1Sunday = new Date(t1Monday);
  t1Sunday.setDate(t1Monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${t1Monday.toLocaleDateString("en-US", opts)} – ${t1Sunday.toLocaleDateString("en-US", opts)}`;
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

/** Get the months that belong to a quarter key like "2026-Q1" */
function getQuarterMonths(quarterKey: string): string[] {
  const [year, qStr] = quarterKey.split("-Q");
  const q = parseInt(qStr, 10);
  const startMonth = (q - 1) * 3 + 1;
  return [
    `${year}-${String(startMonth).padStart(2, "0")}`,
    `${year}-${String(startMonth + 1).padStart(2, "0")}`,
    `${year}-${String(startMonth + 2).padStart(2, "0")}`,
  ];
}

/** Get month string (YYYY-MM) from a lock_week date string (YYYY-MM-DD) */
function getMonthFromLockWeek(lockWeek: string): string {
  // The T1 week is lockWeek + 7 days. Use that week's Monday to determine the month.
  const weekDate = new Date(lockWeek + "T00:00:00");
  const t1Monday = new Date(weekDate);
  t1Monday.setDate(weekDate.getDate() + 7);
  const year = t1Monday.getFullYear();
  const month = String(t1Monday.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

interface MonthlyAdherence {
  month: string;
  totalLocked: number;
  withReason: number;
  adhered: number;
  adherencePercent: number;
  weeks: AdherenceStats[];
}

interface QuarterlyAdherence {
  quarter: string;
  label: string;
  totalLocked: number;
  withReason: number;
  adhered: number;
  adherencePercent: number;
}

function exportToExcel(records: AdherenceRecord[], filename: string) {
  // Sort by data center alphabetically
  const sorted = [...records].sort((a, b) => {
    const dcA = (a.dataCenter || "").toLowerCase();
    const dcB = (b.dataCenter || "").toLowerCase();
    return dcA.localeCompare(dcB);
  });

  const data = sorted.map(r => ({
    "Work Order": r.workOrderNumber,
    "Description": r.description || "",
    "Data Center": r.dataCenter || "",
    "Lock Week": r.lockWeek,
    "Reason": r.reason,
    "Submitted At": r.submittedAt || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  // Set column widths
  ws["!cols"] = [
    { wch: 14 }, // Work Order
    { wch: 40 }, // Description
    { wch: 14 }, // Data Center
    { wch: 14 }, // Lock Week
    { wch: 24 }, // Reason
    { wch: 22 }, // Submitted At
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Schedule Adherence");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function getAdherenceColor(percent: number): string {
  if (percent >= 80) return "text-green-600";
  if (percent >= 60) return "text-yellow-600";
  return "text-red-600";
}

function getAdherenceBg(percent: number): string {
  if (percent >= 80) return "bg-green-50 border-green-200";
  if (percent >= 60) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

export default function ScheduleAdherenceTab() {
  const [summary, setSummary] = useState<AdherenceSummary[]>([]);
  const [allRecords, setAllRecords] = useState<AdherenceRecord[]>([]);
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, records, stats] = await Promise.all([
          getScheduleAdherenceSummary(),
          getScheduleAdherence(),
          getScheduleAdherenceStats(),
        ]);
        setSummary(summaryData);
        setAllRecords(records);
        setAdherenceStats(stats);
      } catch (error) {
        console.error("Error loading adherence data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute monthly adherence from stats (per lock week)
  const monthlyAdherence: MonthlyAdherence[] = useMemo(() => {
    const monthMap = new Map<string, { totalLocked: number; withReason: number; weeks: AdherenceStats[] }>();

    adherenceStats.forEach(stat => {
      const month = getMonthFromLockWeek(stat.lockWeek);
      if (!monthMap.has(month)) {
        monthMap.set(month, { totalLocked: 0, withReason: 0, weeks: [] });
      }
      const entry = monthMap.get(month)!;
      entry.totalLocked += stat.totalLocked;
      entry.withReason += stat.withReason;
      entry.weeks.push(stat);
    });

    const months = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

    return months.map(month => {
      const entry = monthMap.get(month)!;
      const adhered = entry.totalLocked - entry.withReason;
      const adherencePercent = entry.totalLocked > 0
        ? Math.round((adhered / entry.totalLocked) * 100)
        : 0;
      // Sort weeks chronologically
      entry.weeks.sort((a, b) => a.lockWeek.localeCompare(b.lockWeek));
      return { month, ...entry, adhered, adherencePercent };
    });
  }, [adherenceStats]);

  // Compute quarterly adherence
  const quarterlyAdherence: QuarterlyAdherence[] = useMemo(() => {
    const quarterMap = new Map<string, { totalLocked: number; withReason: number }>();

    monthlyAdherence.forEach(ma => {
      const qKey = getQuarterKey(ma.month);
      if (!quarterMap.has(qKey)) {
        quarterMap.set(qKey, { totalLocked: 0, withReason: 0 });
      }
      const entry = quarterMap.get(qKey)!;
      entry.totalLocked += ma.totalLocked;
      entry.withReason += ma.withReason;
    });

    const quarters = Array.from(quarterMap.keys()).sort((a, b) => b.localeCompare(a));

    return quarters.map(qKey => {
      const entry = quarterMap.get(qKey)!;
      const adhered = entry.totalLocked - entry.withReason;
      const adherencePercent = entry.totalLocked > 0
        ? Math.round((adhered / entry.totalLocked) * 100)
        : 0;
      return { quarter: qKey, label: getQuarterLabel(qKey), ...entry, adhered, adherencePercent };
    });
  }, [monthlyAdherence]);

  // Overall adherence
  const overallAdherence = useMemo(() => {
    const totalLocked = adherenceStats.reduce((sum, s) => sum + s.totalLocked, 0);
    const withReason = adherenceStats.reduce((sum, s) => sum + s.withReason, 0);
    const adhered = totalLocked - withReason;
    const adherencePercent = totalLocked > 0 ? Math.round((adhered / totalLocked) * 100) : 0;
    return { totalLocked, withReason, adhered, adherencePercent };
  }, [adherenceStats]);

  const monthlyData: MonthData[] = useMemo(() => {
    const monthMap = new Map<string, Map<string, number>>();
    
    summary.forEach(row => {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, new Map());
      }
      monthMap.get(row.month)!.set(row.reason, Number(row.count));
    });

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

  /** Filter records for a specific month (YYYY-MM) */
  const getRecordsForMonth = useCallback((month: string): AdherenceRecord[] => {
    return allRecords.filter(r => {
      if (r.lockWeek && r.lockWeek.startsWith(month)) return true;
      if (r.submittedAt && r.submittedAt.startsWith(month)) return true;
      return false;
    });
  }, [allRecords]);

  /** Filter records for a specific quarter */
  const getRecordsForQuarter = useCallback((quarterKey: string): AdherenceRecord[] => {
    const months = getQuarterMonths(quarterKey);
    return allRecords.filter(r => {
      const lockMonth = r.lockWeek ? r.lockWeek.substring(0, 7) : "";
      const submitMonth = r.submittedAt ? r.submittedAt.substring(0, 7) : "";
      return months.includes(lockMonth) || months.includes(submitMonth);
    });
  }, [allRecords]);

  const handleExportMonth = useCallback((month: string) => {
    const records = getRecordsForMonth(month);
    const label = formatMonth(month).replace(" ", "_");
    exportToExcel(records, `Schedule_Adherence_${label}`);
  }, [getRecordsForMonth]);

  const handleExportQuarter = useCallback((quarterKey: string) => {
    const records = getRecordsForQuarter(quarterKey);
    const label = getQuarterLabel(quarterKey).replace(" ", "_");
    exportToExcel(records, `Schedule_Adherence_${label}`);
  }, [getRecordsForQuarter]);

  const handleExportAll = useCallback(() => {
    exportToExcel(allRecords, "Schedule_Adherence_All");
  }, [allRecords]);

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

  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-sm px-3 py-2 shadow-sm">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
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

  /** Render the adherence percentage badge */
  const renderAdherenceBadge = (percent: number, totalLocked: number, adhered: number) => {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${getAdherenceBg(percent)}`}>
        <span className={`text-lg font-bold ${getAdherenceColor(percent)}`}>{percent}%</span>
        <span className="text-xs text-muted-foreground">
          {adhered}/{totalLocked} adhered
        </span>
      </div>
    );
  };

  /** Render weekly breakdown table for a month */
  const renderWeeklyBreakdown = (weeks: AdherenceStats[]) => {
    if (weeks.length === 0) return null;
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Weekly Breakdown</h4>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-sm font-medium text-foreground">Week</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-foreground">Locked</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-foreground">With Reason</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-foreground">Adherence</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(week => (
              <tr key={week.lockWeek} className="border-b border-border/50">
                <td className="py-2 px-3 text-sm">{formatWeekRange(week.lockWeek)}</td>
                <td className="py-2 px-3 text-sm text-right">{week.totalLocked}</td>
                <td className="py-2 px-3 text-sm text-right">{week.withReason}</td>
                <td className="py-2 px-3 text-sm text-right">
                  <span className={`font-semibold ${getAdherenceColor(week.adherencePercent)}`}>
                    {week.adherencePercent}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

  const hasAnyData = monthlyData.length > 0 || adherenceStats.length > 0;

  if (!hasAnyData) {
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
      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Adherence */}
        <Card className={`border ${getAdherenceBg(overallAdherence.adherencePercent)}`}>
          <CardContent className="py-6 text-center">
            <div className={`text-4xl font-bold ${getAdherenceColor(overallAdherence.adherencePercent)}`}>
              {overallAdherence.adherencePercent}%
            </div>
            <div className="text-sm text-muted-foreground mt-2">Overall Adherence</div>
            <div className="text-xs text-muted-foreground mt-1">
              {overallAdherence.adhered} of {overallAdherence.totalLocked} locked WOs adhered
            </div>
          </CardContent>
        </Card>

        {/* Total Incomplete Tracked */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6 text-center">
            <div className="text-4xl font-bold text-primary">{overallTotals.total}</div>
            <div className="text-sm text-muted-foreground mt-2">Incomplete WOs Tracked</div>
            <div className="text-xs text-muted-foreground mt-1">
              With reasons across {monthlyData.length} month{monthlyData.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardContent className="py-6 flex flex-col items-center justify-center gap-3">
            <div className="text-sm text-muted-foreground">Export adherence data</div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export All Records
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Adherence Trend Bar Chart */}
      {monthlyAdherence.length > 1 && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">Adherence Trend</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Monthly adherence percentage over time (locked WOs without a reason vs total locked)
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...monthlyAdherence].reverse().map(ma => ({
                    name: formatMonth(ma.month),
                    "Adhered": ma.adhered,
                    "With Reason": ma.withReason,
                    adherencePercent: ma.adherencePercent,
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<BarTooltip />} />
                  <Legend />
                  <Bar dataKey="Adhered" stackId="a" fill="#5b8a72" />
                  <Bar dataKey="With Reason" stackId="a" fill="#d4726a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Breakdown (reasons pie chart) */}
      {monthlyData.length > 1 && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">Overall Reason Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Aggregated reasons for incomplete locked work orders across all months
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {renderPieChart(overallTotals.reasons, overallTotals.total)}
          </CardContent>
        </Card>
      )}

      {/* Quarterly Breakdown */}
      {quarterlyData.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-foreground pt-2">Quarterly Breakdown</h2>
          {quarterlyData.map(qData => {
            const qAdherence = quarterlyAdherence.find(qa => qa.quarter === qData.quarter);
            return (
              <Card key={qData.quarter}>
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl font-medium">{qData.label}</CardTitle>
                        {qAdherence && renderAdherenceBadge(qAdherence.adherencePercent, qAdherence.totalLocked, qAdherence.adhered)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {qData.total} incomplete work order{qData.total !== 1 ? "s" : ""} tracked
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportQuarter(qData.quarter)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {renderPieChart(qData.reasons, qData.total)}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Monthly Breakdown */}
      <h2 className="text-lg font-semibold text-foreground pt-2">Monthly Breakdown</h2>
      {monthlyData.map(monthData => {
        const mAdherence = monthlyAdherence.find(ma => ma.month === monthData.month);
        return (
          <Card key={monthData.month}>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl font-medium">{formatMonth(monthData.month)}</CardTitle>
                    {mAdherence && renderAdherenceBadge(mAdherence.adherencePercent, mAdherence.totalLocked, mAdherence.adhered)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {monthData.total} incomplete work order{monthData.total !== 1 ? "s" : ""} tracked
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportMonth(monthData.month)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {renderPieChart(monthData.reasons, monthData.total)}
              {mAdherence && renderWeeklyBreakdown(mAdherence.weeks)}
            </CardContent>
          </Card>
        );
      })}

      {/* Show months with adherence data but no reason data */}
      {monthlyAdherence
        .filter(ma => !monthlyData.find(md => md.month === ma.month))
        .map(ma => (
          <Card key={`adherence-only-${ma.month}`}>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl font-medium">{formatMonth(ma.month)}</CardTitle>
                {renderAdherenceBadge(ma.adherencePercent, ma.totalLocked, ma.adhered)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                No incomplete reason data submitted for this month
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {renderWeeklyBreakdown(ma.weeks)}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
