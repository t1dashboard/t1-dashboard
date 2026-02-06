/**
 * Swiss Rationalism: Hairline dividers, systematic grid, monospace work order numbers
 * Separated into Day Shift and Night Shift sections
 */

import { useMemo } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";
import { isNightShift } from "@/lib/nightShiftEmployees";

interface WorkLoadTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WorkLoadTab({ workOrders }: WorkLoadTabProps) {
  const workloadByDay = useMemo(() => {
    // Use all work orders with valid scheduled start dates
    const filtered = workOrders.filter((wo) => {
      return wo["Sched. Start Date"] && wo["Sched. Start Date"] !== "";
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
          const shift = isNightShift(wo["Assigned To Name"]) ? 'night' : 'day';
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
              <td className="py-3 px-4 text-sm">
                {formatDate(wo["Sched. Start Date"])}
              </td>
              <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
              <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
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
    </div>
  );
}
