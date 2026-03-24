/**
 * Swiss Rationalism: Hairline dividers, systematic grid, monospace work order numbers
 * Separated into Day Shift (7:00 AM - 6:59 PM) and Night Shift sections
 * Color-coded by risk level: green (low/none), yellow (medium), red (high)
 * Supports T1/T2/T3 week selection via weekFilter prop
 * Calendar view supports both weekly and daily modes
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, parseExcelDate, getTWeekRange, isTWeek } from "@/lib/dateUtils";
import { isNightShift } from "@/lib/nightShiftEmployees";
import { Calendar, List, ChevronLeft, ChevronRight } from "lucide-react";
import { getTeamsForDate, getTeamsByShift, TEAMS, type TeamCode } from "@/lib/teamSchedule";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type WeekFilter = "t0" | "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7" | "t8";

/** Map a WeekFilter string to its numeric offset (1–8). */
function weekNumber(filter: WeekFilter): number {
  return parseInt(filter.slice(1), 10);
}

interface WorkLoadTabProps {
  workOrders: WorkOrder[];
  weekFilter?: WeekFilter;
  onWeekChange?: (week: WeekFilter) => void;
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Determine the risk level of a work order based on Operational LOR and EHS LOR fields.
 * Returns 'high', 'medium', or 'low'.
 */
function getRiskLevel(wo: WorkOrder): 'high' | 'medium' | 'low' {
  const opRisk = (wo["Operational LOR"] || "").toUpperCase().trim();
  const ehsRisk = (wo["EHS LOR"] || "").toUpperCase().trim();

  if (opRisk.includes("HIGH") || ehsRisk.includes("HIGH")) {
    return 'high';
  }
  if (opRisk.includes("MEDIUM") || ehsRisk.includes("MEDIUM")) {
    return 'medium';
  }
  return 'low';
}

/**
 * Get background color class based on risk level.
 */
function getRiskBgClass(risk: 'high' | 'medium' | 'low'): string {
  switch (risk) {
    case 'high': return 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800';
    case 'low': return 'bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800';
  }
}

/**
 * Get row background color for table rows based on risk level.
 */
function getRiskRowBg(risk: 'high' | 'medium' | 'low'): string {
  switch (risk) {
    case 'high': return 'bg-red-50 dark:bg-red-950/30';
    case 'medium': return 'bg-yellow-50 dark:bg-yellow-950/30';
    case 'low': return 'bg-green-50 dark:bg-green-950/30';
  }
}

/** Return the correct week-check function for the given filter. */
function getWeekChecker(filter: WeekFilter): (date: any) => boolean {
  const n = weekNumber(filter);
  return (date: any) => isTWeek(date, n);
}

/** Return the correct week range for the given filter. */
function getWeekRange(filter: WeekFilter): { start: Date; end: Date } {
  return getTWeekRange(weekNumber(filter));
}

/** Human-readable label for the week filter. */
function getWeekLabel(filter: WeekFilter): string {
  return filter === "t0" ? "T0 (This Week)" : filter.toUpperCase();
}

export default function WorkLoadTab({ workOrders, weekFilter = "t1", onWeekChange }: WorkLoadTabProps) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [calendarMode, setCalendarMode] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 0 = Monday

  const isInWeek = useMemo(() => getWeekChecker(weekFilter), [weekFilter]);
  const weekRange = useMemo(() => getWeekRange(weekFilter), [weekFilter]);
  const weekLabel = getWeekLabel(weekFilter);

  // Get In Process work orders that span the selected week
  const inProcessOrders = useMemo(() => {
    const { start: weekStart, end: weekEnd } = weekRange;
    
    const filtered = workOrders.filter((wo) => {
      const isInProcess = wo["Status"]?.toUpperCase() === "IN PROCESS" || wo["Status"]?.toUpperCase() === "INPROCESS" || wo["Status"]?.toUpperCase() === "IN-PROCESS";
      if (!isInProcess) return false;
      
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isWeekly = wo["Description"]?.toUpperCase().includes("WEEKLY");
      if (isCancelled || isCMCC || isWeekly) return false;
      
      const schedStart = parseExcelDate(wo["Sched. Start Date"]);
      const schedEnd = parseExcelDate(wo["Sched. End Date"]);
      
      if (!schedStart || !schedEnd) return false;
      
      // Check if the work order overlaps with the selected week
      return schedStart <= weekEnd && schedEnd >= weekStart;
    });
    
    // Sort by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders, weekRange]);

  const workloadByDay = useMemo(() => {
    // Filter for selected week's work orders only, excluding cancelled, CMCC Daily Work Orders, and weekly work orders
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isWeekly = wo["Description"]?.toUpperCase().includes("WEEKLY");
      return !isCancelled && !isCMCC && !isWeekly && wo["Sched. Start Date"] && wo["Sched. Start Date"] !== "" && isInWeek(wo["Sched. Start Date"]);
    });

    // Group by day of week and shift
    const grouped: Record<string, { day: WorkOrder[], night: WorkOrder[] }> = {};
    DAYS_OF_WEEK.forEach(day => {
      grouped[day] = { day: [], night: [] };
    });

    filtered.forEach((wo) => {
      const schedDate = parseExcelDate(wo["Sched. Start Date"]);
      if (schedDate) {
        const dayName = schedDate.toLocaleDateString("en-US", { weekday: "long" });
        if (grouped[dayName]) {
          const shift = isNightShift(wo["Shift"]) ? 'night' : 'day';
          grouped[dayName][shift].push(wo);
        }
      }
    });

    // Sort each shift's work orders by data center
    Object.keys(grouped).forEach((day) => {
      grouped[day].day.sort((a, b) => {
        const dcA = a["Data Center"] || "";
        const dcB = b["Data Center"] || "";
        return dcA.localeCompare(dcB);
      });
      grouped[day].night.sort((a, b) => {
        const dcA = a["Data Center"] || "";
        const dcB = b["Data Center"] || "";
        return dcA.localeCompare(dcB);
      });
    });

    return grouped;
  }, [workOrders, isInWeek]);

  const renderTable = (orders: WorkOrder[]) => (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <colgroup>
          <col style={{ width: "7%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched End Date</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Supervisor</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Risk</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((wo) => {
            const risk = getRiskLevel(wo);
            return (
              <tr 
                key={wo["Work Order"]} 
                className={`border-b border-border/50 hover:opacity-80 transition-colors ${getRiskRowBg(risk)}`}
                style={{ borderBottomWidth: '0.5px' }}
              >
                <td className="py-3 px-4">
                  <a
                    href={`${BASE_URL}${wo["Work Order"]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="work-order-number text-primary hover:underline"
                  >
                    {wo["Work Order"]}
                  </a>
                </td>
                <td className="py-3 px-4 text-sm truncate">{wo["Description"]}</td>
                <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. Start Date"])}</td>
                <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. End Date"])}</td>
                <td className="py-3 px-4 text-sm">{wo["Shift"]}</td>
                <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                <td className="py-3 px-4 text-sm">{wo["Supervisor"]}</td>
                <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                <td className="py-3 px-4 text-sm font-medium">
                  {risk === 'high' && <span className="text-red-600 dark:text-red-400">High</span>}
                  {risk === 'medium' && <span className="text-yellow-600 dark:text-yellow-400">Medium</span>}
                  {risk === 'low' && <span className="text-green-600 dark:text-green-400">Low</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Calculate total work orders across all days (including in process)
  const totalWorkOrders = useMemo(() => {
    const scheduledTotal = DAYS_OF_WEEK.reduce((total, day) => {
      const dayOrders = workloadByDay[day];
      return total + dayOrders.day.length + dayOrders.night.length;
    }, 0);
    return scheduledTotal + inProcessOrders.length;
  }, [workloadByDay, inProcessOrders]);

  // Format week range for display
  const weekRangeLabel = useMemo(() => {
    const { start, end } = weekRange;
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [weekRange]);

  // Get the actual date for a given day index in the selected week
  const getDayDate = (dayIndex: number): Date => {
    const { start } = weekRange;
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    return date;
  };

  // Format the selected day's date for display
  const selectedDayLabel = useMemo(() => {
    const date = getDayDate(selectedDayIndex);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDayIndex, weekRange]);

  // Get the selected day's name
  const selectedDayName = DAYS_OF_WEEK[selectedDayIndex];

  // Render the risk legend
  const renderRiskLegend = () => (
    <div className="flex items-center gap-4 mb-4 text-xs">
      <span className="font-medium text-muted-foreground">Risk Level:</span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-400"></span>
        Low
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-400"></span>
        Medium
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-400"></span>
        High
      </span>
    </div>
  );

  // Render a single WO card for calendar views
  const renderWOCard = (wo: WorkOrder) => {
    const risk = getRiskLevel(wo);
    return (
      <a
        key={wo["Work Order"]}
        href={`${BASE_URL}${wo["Work Order"]}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`block p-1 border rounded text-[10px] leading-tight hover:opacity-80 transition-colors ${getRiskBgClass(risk)}`}
      >
        <div className="font-semibold text-primary">{wo["Work Order"]}</div>
        <div className="text-muted-foreground truncate" title={wo["Description"]}>
          {wo["Description"]}
        </div>
        <div className="font-medium mt-0.5">{wo["Data Center"]}</div>
      </a>
    );
  };

  // Render weekly calendar view as one big table-style layout with Day/Night horizontal divider
  const renderWeeklyCalendarView = () => (
    <Card>
      <CardContent className="p-4">
        {renderRiskLegend()}

        <table className="w-full border-collapse border border-border">
          {/* Header Row - Day Names */}
          <thead>
            <tr>
              <th className="border border-border bg-muted/30 p-1 text-xs font-medium text-muted-foreground w-[60px]"></th>
              {DAYS_OF_WEEK.map((day, idx) => {
                const dayOrders = workloadByDay[day];
                const totalOrders = dayOrders.day.length + dayOrders.night.length;
                const dayDate = getDayDate(idx);
                const dateStr = `${String(dayDate.getMonth() + 1).padStart(2, '0')}/${String(dayDate.getDate()).padStart(2, '0')}/${dayDate.getFullYear()}`;
                return (
                  <th key={day} className="border border-border bg-muted/50 p-2 text-center">
                    <div className="font-semibold text-sm">{day}</div>
                    <div className="text-xs text-muted-foreground font-normal">{dateStr}</div>
                    <div className="text-xs text-muted-foreground font-normal">{totalOrders} WOs</div>
                    <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                      {getTeamsForDate(dayDate).map((team) => (
                        <span
                          key={team}
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${TEAMS[team].color} ${TEAMS[team].textColor}`}
                          title={TEAMS[team].label}
                        >
                          {team}
                        </span>
                      ))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Day Shift Row */}
            <tr className="align-top">
              <td className="border border-border bg-amber-50 dark:bg-amber-950/30 p-2 text-center">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">☀️</div>
                <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 mt-1">DAYS</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">7AM–7PM</div>
              </td>
              {DAYS_OF_WEEK.map((day) => {
                const dayOrders = workloadByDay[day];
                return (
                  <td key={day} className="border border-border p-1.5 align-top">
                    <div className="space-y-1">
                      {dayOrders.day.length > 0 ? (
                        dayOrders.day.map((wo) => renderWOCard(wo))
                      ) : (
                        <div className="text-[10px] text-muted-foreground text-center py-2">—</div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Horizontal Divider Row */}
            <tr>
              <td colSpan={8} className="border border-border bg-border h-[3px] p-0"></td>
            </tr>

            {/* Night Shift Row */}
            <tr className="align-top">
              <td className="border border-border bg-indigo-50 dark:bg-indigo-950/30 p-2 text-center">
                <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">🌙</div>
                <div className="text-[10px] font-semibold text-indigo-800 dark:text-indigo-300 mt-1">NIGHTS</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">7PM–7AM</div>
              </td>
              {DAYS_OF_WEEK.map((day) => {
                const dayOrders = workloadByDay[day];
                return (
                  <td key={day} className="border border-border p-1.5 align-top">
                    <div className="space-y-1">
                      {dayOrders.night.length > 0 ? (
                        dayOrders.night.map((wo) => renderWOCard(wo))
                      ) : (
                        <div className="text-[10px] text-muted-foreground text-center py-2">—</div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  // Render daily calendar view - expanded view for a single day
  const renderDailyCalendarView = () => {
    const dayOrders = workloadByDay[selectedDayName];
    const totalOrders = dayOrders.day.length + dayOrders.night.length;
    const dayDate = getDayDate(selectedDayIndex);
    const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Group day shift by data center
    const dayShiftByDC: Record<string, WorkOrder[]> = {};
    dayOrders.day.forEach(wo => {
      const dc = wo["Data Center"] || "Unknown";
      if (!dayShiftByDC[dc]) dayShiftByDC[dc] = [];
      dayShiftByDC[dc].push(wo);
    });
    const sortedDayDCs = Object.keys(dayShiftByDC).sort();

    // Group night shift by data center
    const nightShiftByDC: Record<string, WorkOrder[]> = {};
    dayOrders.night.forEach(wo => {
      const dc = wo["Data Center"] || "Unknown";
      if (!nightShiftByDC[dc]) nightShiftByDC[dc] = [];
      nightShiftByDC[dc].push(wo);
    });
    const sortedNightDCs = Object.keys(nightShiftByDC).sort();

    return (
      <Card>
        <CardContent className="p-4">
          {renderRiskLegend()}

          {/* Day Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))}
              disabled={selectedDayIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-center">
              <div className="text-lg font-semibold">{selectedDayName}</div>
              <div className="text-sm text-muted-foreground">{dateStr} — {totalOrders} work orders</div>
              <div className="flex gap-1 justify-center mt-1">
                {getTeamsForDate(dayDate).map((team) => (
                  <span
                    key={team}
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${TEAMS[team].color} ${TEAMS[team].textColor}`}
                    title={TEAMS[team].label}
                  >
                    {team}
                  </span>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDayIndex(Math.min(6, selectedDayIndex + 1))}
              disabled={selectedDayIndex === 6}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Day selector pills */}
          <div className="flex gap-1 mb-4 justify-center">
            {DAYS_OF_WEEK.map((day, idx) => {
              const orders = workloadByDay[day];
              const count = orders.day.length + orders.night.length;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    idx === selectedDayIndex
                      ? 'bg-primary text-primary-foreground'
                      : count > 0
                        ? 'bg-muted hover:bg-muted/80 text-foreground'
                        : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <div>{day.slice(0, 3)}</div>
                  {count > 0 && (
                    <span className={`${idx === selectedDayIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      ({count})
                    </span>
                  )}
                  <div className="flex gap-0.5 justify-center mt-0.5">
                    {getTeamsForDate(getDayDate(idx)).map((team) => (
                      <span
                        key={team}
                        className={`inline-block px-1 py-0 rounded text-[8px] font-bold ${TEAMS[team].color} ${TEAMS[team].textColor}`}
                      >
                        {team}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {totalOrders === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No work orders scheduled for {selectedDayName}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Day Shift Section */}
              {dayOrders.day.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      ☀️ Day Shift ({dayOrders.day.length})
                      <span className="text-xs font-normal text-muted-foreground">7:00 AM – 6:59 PM</span>
                    </h4>
                  </div>
                  {sortedDayDCs.map(dc => (
                    <div key={dc} className="border-b border-border/50 last:border-b-0">
                      <div className="px-4 py-2 bg-muted/30 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground">{dc} ({dayShiftByDC[dc].length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3">
                        {dayShiftByDC[dc].map(wo => {
                          const risk = getRiskLevel(wo);
                          return (
                            <a
                              key={wo["Work Order"]}
                              href={`${BASE_URL}${wo["Work Order"]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`block p-2 border rounded text-xs leading-tight hover:opacity-80 transition-colors ${getRiskBgClass(risk)}`}
                            >
                              <div className="font-semibold text-primary">{wo["Work Order"]}</div>
                              <div className="text-muted-foreground mt-0.5 line-clamp-2" title={wo["Description"]}>
                                {wo["Description"]}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="font-medium">{wo["Data Center"]}</span>
                                <span className="text-muted-foreground">{wo["Shift"]}</span>
                              </div>
                              <div className="text-muted-foreground mt-0.5">{wo["Status"]}</div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Night Shift Section */}
              {dayOrders.night.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                      🌙 Night Shift ({dayOrders.night.length})
                      <span className="text-xs font-normal text-muted-foreground">7:00 PM – 6:59 AM</span>
                    </h4>
                  </div>
                  {sortedNightDCs.map(dc => (
                    <div key={dc} className="border-b border-border/50 last:border-b-0">
                      <div className="px-4 py-2 bg-muted/30 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground">{dc} ({nightShiftByDC[dc].length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3">
                        {nightShiftByDC[dc].map(wo => {
                          const risk = getRiskLevel(wo);
                          return (
                            <a
                              key={wo["Work Order"]}
                              href={`${BASE_URL}${wo["Work Order"]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`block p-2 border rounded text-xs leading-tight hover:opacity-80 transition-colors ${getRiskBgClass(risk)}`}
                            >
                              <div className="font-semibold text-primary">{wo["Work Order"]}</div>
                              <div className="text-muted-foreground mt-0.5 line-clamp-2" title={wo["Description"]}>
                                {wo["Description"]}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="font-medium">{wo["Data Center"]}</span>
                                <span className="text-muted-foreground">{wo["Shift"]}</span>
                              </div>
                              <div className="text-muted-foreground mt-0.5">{wo["Status"]}</div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Total Summary Card with View Toggle */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-medium text-foreground">
                {weekLabel} Workload Summary
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{weekRangeLabel}</p>
              <p className="text-lg text-foreground mt-2">
                <span className="font-semibold">{totalWorkOrders}</span> total work orders for {weekLabel} week
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendar
                </Button>
              </div>
              {/* Calendar sub-mode toggle: Weekly / Daily */}
              {viewMode === 'calendar' && (
                <div className="flex gap-1 bg-muted rounded-md p-0.5">
                  <button
                    onClick={() => setCalendarMode('weekly')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      calendarMode === 'weekly'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setCalendarMode('daily')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      calendarMode === 'daily'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Daily
                  </button>
                </div>
              )}
              {onWeekChange && (
                <Select value={weekFilter} onValueChange={(v) => onWeekChange(v as WeekFilter)}>
                  <SelectTrigger className="w-[240px] h-9">
                    <SelectValue placeholder="Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["t0","t1","t2","t3","t4","t5","t6","t7","t8"] as WeekFilter[]).map((wk) => {
                      const n = weekNumber(wk);
                      const { start, end } = getTWeekRange(n);
                      const label = n === 0 ? "T0 (This Week)" : `T${n} Week`;
                      const dateHint = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                      return (
                        <SelectItem key={wk} value={wk}>
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{dateHint}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {viewMode === 'calendar' ? (
        <>
          {calendarMode === 'weekly' ? renderWeeklyCalendarView() : renderDailyCalendarView()}
          {/* In Process Work Orders Section - shown below calendar */}
          {inProcessOrders.length > 0 && (
            <Card className="border-orange-500/30 bg-orange-50/30 dark:bg-orange-950/20">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xl font-medium">In Process Work Orders</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {inProcessOrders.length} work orders currently in process that span the {weekLabel} week
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {renderTable(inProcessOrders)}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
        {/* Risk Legend for List View */}
        <div className="flex items-center gap-4 text-sm px-1">
          <span className="font-medium text-muted-foreground">Risk Level:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-400"></span>
            Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-400"></span>
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-400"></span>
            High
          </span>
        </div>

        {DAYS_OF_WEEK.map((day) => {
        const dayOrders = workloadByDay[day];
        const totalOrders = dayOrders.day.length + dayOrders.night.length;
        if (totalOrders === 0) return null;

        return (
          <Card key={day}>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-medium">
                {day}
                <span className="text-base font-normal text-muted-foreground ml-2">
                  {(() => { const idx = DAYS_OF_WEEK.indexOf(day); const d = getDayDate(idx); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`; })()}
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalOrders} work orders ({dayOrders.day.length} day shift, {dayOrders.night.length} night shift)
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {/* Day Shift Section: 7:00 AM - 6:59 PM */}
              {dayOrders.day.length > 0 && (
                <div className="border-b border-border">
                  <div className="bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2 border-b border-border/50">
                    <h4 className="text-sm font-medium text-foreground">
                      ☀️ Day Shift ({dayOrders.day.length}) <span className="text-xs font-normal text-muted-foreground">7:00 AM – 6:59 PM</span>
                    </h4>
                  </div>
                  {renderTable(dayOrders.day)}
                </div>
              )}

              {/* Night Shift Section: 7:00 PM - 6:59 AM */}
              {dayOrders.night.length > 0 && (
                <div>
                  <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-2 border-b border-border/50">
                    <h4 className="text-sm font-medium text-foreground">
                      🌙 Night Shift ({dayOrders.night.length}) <span className="text-xs font-normal text-muted-foreground">7:00 PM – 6:59 AM</span>
                    </h4>
                  </div>
                  {renderTable(dayOrders.night)}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      
      {/* In Process Work Orders Section */}
      {inProcessOrders.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-50/30 dark:bg-orange-950/20">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">In Process Work Orders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {inProcessOrders.length} work orders currently in process that span the {weekLabel} week
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {renderTable(inProcessOrders)}
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
