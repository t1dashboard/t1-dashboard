/**
 * Swiss Rationalism: Hairline dividers, systematic grid, monospace work order numbers
 * Separated into Day Shift (7:00 AM - 6:59 PM) and Night Shift sections
 * Color-coded by risk level: green (low/none), yellow (medium), red (high)
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, parseExcelDate, isNextWeek, getNextWeekRange } from "@/lib/dateUtils";
import { isNightShift } from "@/lib/nightShiftEmployees";
import { Calendar, List } from "lucide-react";

interface WorkLoadTabProps {
  workOrders: WorkOrder[];
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

export default function WorkLoadTab({ workOrders }: WorkLoadTabProps) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Get In Process work orders that span the T1 week
  const inProcessOrders = useMemo(() => {
    const { start: weekStart, end: weekEnd } = getNextWeekRange();
    
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
      
      // Check if the work order overlaps with T1 week
      return schedStart <= weekEnd && schedEnd >= weekStart;
    });
    
    // Sort by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  const workloadByDay = useMemo(() => {
    // Filter for next week's work orders only, excluding cancelled, CMCC Daily Work Orders, and weekly work orders
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isWeekly = wo["Description"]?.toUpperCase().includes("WEEKLY");
      return !isCancelled && !isCMCC && !isWeekly && wo["Sched. Start Date"] && wo["Sched. Start Date"] !== "" && isNextWeek(wo["Sched. Start Date"]);
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
  }, [workOrders]);

  const renderTable = (orders: WorkOrder[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched End Date</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
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
                <td className="py-3 px-4 text-sm">{wo["Description"]}</td>
                <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. Start Date"])}</td>
                <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. End Date"])}</td>
                <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
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

  // Render calendar view as one big table-style layout with Day/Night horizontal divider
  const renderCalendarView = () => (
    <Card>
      <CardContent className="p-4">
        {/* Risk Legend */}
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

        <table className="w-full border-collapse border border-border">
          {/* Header Row - Day Names */}
          <thead>
            <tr>
              <th className="border border-border bg-muted/30 p-1 text-xs font-medium text-muted-foreground w-[60px]"></th>
              {DAYS_OF_WEEK.map((day) => {
                const dayOrders = workloadByDay[day];
                const totalOrders = dayOrders.day.length + dayOrders.night.length;
                return (
                  <th key={day} className="border border-border bg-muted/50 p-2 text-center">
                    <div className="font-semibold text-sm">{day}</div>
                    <div className="text-xs text-muted-foreground font-normal">{totalOrders} WOs</div>
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
                        dayOrders.day.map((wo) => {
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
                        })
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
                        dayOrders.night.map((wo) => {
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
                        })
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

  return (
    <div className="space-y-6">
      {/* Total Summary Card with View Toggle */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-medium text-foreground">
                T1 Workload Summary
              </CardTitle>
              <p className="text-lg text-foreground mt-2">
                <span className="font-semibold">{totalWorkOrders}</span> total work orders for next week
              </p>
            </div>
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
          </div>
        </CardHeader>
      </Card>
      
      {viewMode === 'calendar' ? (
        renderCalendarView()
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
              <CardTitle className="text-xl font-medium">{day}</CardTitle>
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
              {inProcessOrders.length} work orders currently in process that span the T1 week
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
