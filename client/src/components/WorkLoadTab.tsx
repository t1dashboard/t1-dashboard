/**
 * Swiss Rationalism: Hairline dividers, systematic grid, monospace work order numbers
 * Separated into Day Shift and Night Shift sections
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
          </tr>
        </thead>
        <tbody>
          {orders.map((wo) => (
            <tr 
              key={wo["Work Order"]} 
              className="border-b border-border/50 hover:bg-muted/20 transition-colors"
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
            </tr>
          ))}
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

  // Render calendar view
  const renderCalendarView = () => (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map((day) => {
            const dayOrders = workloadByDay[day];
            const totalOrders = dayOrders.day.length + dayOrders.night.length;
            
            return (
              <div key={day} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-2 border-b border-border">
                  <h3 className="font-medium text-sm text-center">{day}</h3>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {totalOrders} WOs
                  </p>
                </div>
                <div className="p-2 space-y-2 min-h-[300px] max-h-[600px] overflow-y-auto">
                  {/* Day Shift */}
                  {dayOrders.day.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Day ({dayOrders.day.length})</div>
                      {dayOrders.day.map((wo) => (
                        <a
                          key={wo["Work Order"]}
                          href={`${BASE_URL}${wo["Work Order"]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 bg-card border border-border rounded text-xs hover:bg-muted/50 transition-colors mb-1"
                        >
                          <div className="font-medium text-primary">{wo["Work Order"]}</div>
                          <div className="text-muted-foreground truncate" title={wo["Description"]}>
                            {wo["Description"]}
                          </div>
                          <div className="font-medium mt-1">{wo["Data Center"]}</div>
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Night Shift */}
                  {dayOrders.night.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Night ({dayOrders.night.length})</div>
                      {dayOrders.night.map((wo) => (
                        <a
                          key={wo["Work Order"]}
                          href={`${BASE_URL}${wo["Work Order"]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 bg-card border border-border rounded text-xs hover:bg-muted/50 transition-colors mb-1"
                        >
                          <div className="font-medium text-primary">{wo["Work Order"]}</div>
                          <div className="text-muted-foreground truncate" title={wo["Description"]}>
                            {wo["Description"]}
                          </div>
                          <div className="font-medium mt-1">{wo["Data Center"]}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
              {/* Day Shift Section */}
              {dayOrders.day.length > 0 && (
                <div className="border-b border-border">
                  <div className="bg-muted/20 px-4 py-2 border-b border-border/50">
                    <h4 className="text-sm font-medium text-foreground">Day Shift ({dayOrders.day.length})</h4>
                  </div>
                  {renderTable(dayOrders.day)}
                </div>
              )}

              {/* Night Shift Section */}
              {dayOrders.night.length > 0 && (
                <div>
                  <div className="bg-muted/20 px-4 py-2 border-b border-border/50">
                    <h4 className="text-sm font-medium text-foreground">Night Shift ({dayOrders.night.length})</h4>
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
