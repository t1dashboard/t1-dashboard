import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkOrder } from "@/types/workOrder";
import { AlertTriangle } from "lucide-react";

interface ComplianceCheckTabProps {
  workOrders: WorkOrder[];
}

// Convert Excel serial number to JavaScript Date
function excelSerialToDate(serial: number): Date {
  // Excel serial date: days since January 1, 1900
  // JavaScript needs milliseconds since January 1, 1970
  const excelEpoch = new Date(1900, 0, 1); // Jan 1, 1900
  const msPerDay = 24 * 60 * 60 * 1000;
  // Excel has a leap year bug for 1900, so subtract 2 days
  return new Date(excelEpoch.getTime() + (serial - 2) * msPerDay);
}

export default function ComplianceCheckTab({ workOrders }: ComplianceCheckTabProps) {
  const complianceData = useMemo(() => {
    console.log('[ComplianceCheck] Total work orders received:', workOrders.length);
    console.log('[ComplianceCheck] Sample work order:', workOrders[0]);
    
    // Normalize to start of today for comparison
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    console.log('[ComplianceCheck] Today (normalized):', now);
    
    const fifteenDaysFromNow = new Date(now);
    fifteenDaysFromNow.setDate(now.getDate() + 15);
    
    // Calculate upcoming Saturday, Sunday, Monday
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7; // Days until next Saturday
    const upcomingSaturday = new Date(now);
    upcomingSaturday.setDate(now.getDate() + daysUntilSaturday);
    const upcomingSunday = new Date(upcomingSaturday);
    upcomingSunday.setDate(upcomingSaturday.getDate() + 1);
    const upcomingMonday = new Date(upcomingSaturday);
    upcomingMonday.setDate(upcomingSaturday.getDate() + 2);

    const filtered = workOrders
      .filter((wo) => {
        const complianceEnd = wo["Compliance Window End Date"];
        if (!complianceEnd) return false;
        
        // Exclude Closed, Work Complete, Cancelled, and QA Rejected status
        const status = (wo["Status"] || "").toLowerCase();
        if (status === "closed" || status === "work complete" || status === "cancelled" || status === "qa rejected") return false;
        
        // Exclude work orders with "daily" in description
        const description = (wo["Description"] || "").toLowerCase();
        if (description.includes("daily")) return false;

        // Parse date - handle string, number, or Date object
        let complianceDate;
        if (typeof complianceEnd === 'string') {
          // If string, parse it (handles "2026-02-13 09:36:00" format)
          complianceDate = new Date(complianceEnd);
        } else if (typeof complianceEnd === 'number') {
          // If number (Excel serial date), convert it
          complianceDate = excelSerialToDate(complianceEnd);
        } else {
          // Already a Date object
          complianceDate = new Date(complianceEnd);
        }
        
        // Check if date is valid
        if (isNaN(complianceDate.getTime())) {
          console.warn('[ComplianceCheck] Invalid date for WO', wo["Work Order"], ':', complianceEnd);
          return false;
        }
        
        // Normalize compliance date to midnight
        complianceDate.setHours(0, 0, 0, 0);
        
        // Check if work order has "weekly" in description or is the specific monthly NICV PM
        const isWeekly = description.includes("weekly");
        const isMonthlyNICV = description.includes("wet") && 
                              description.includes("dry") && 
                              description.includes("pre-action") && 
                              description.includes("non-indicating") && 
                              description.includes("curb") && 
                              description.includes("valve") && 
                              description.includes("nicv") && 
                              description.includes("pm");
        
        if (isWeekly || isMonthlyNICV) {
          // For weekly/monthly work orders, only include if compliance date is upcoming Sat/Sun/Mon
          const isUpcomingWeekend = 
            complianceDate.getTime() === upcomingSaturday.getTime() ||
            complianceDate.getTime() === upcomingSunday.getTime() ||
            complianceDate.getTime() === upcomingMonday.getTime();
          return isUpcomingWeekend;
        }
        
        // For non-weekly work orders, check if within 15 days
        const isInRange = complianceDate >= now && complianceDate <= fifteenDaysFromNow;
        return isInRange;
      })
      .map((wo) => {
        const complianceEndRaw = wo["Compliance Window End Date"];
        const complianceEnd = typeof complianceEndRaw === 'number' ? excelSerialToDate(complianceEndRaw) : new Date(complianceEndRaw);
        const schedStartRaw = wo["Sched. Start Date"];
        const schedStart = schedStartRaw ? (typeof schedStartRaw === 'number' ? excelSerialToDate(schedStartRaw) : new Date(schedStartRaw)) : null;
        
        // Calculate days until compliance
        const daysUntilCompliance = Math.ceil((complianceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate slack (days between sched start and compliance end)
        const slack = schedStart 
          ? Math.ceil((complianceEnd.getTime() - schedStart.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        // Check if compliance ends on Sat/Sun/Mon
        const dayOfWeek = complianceEnd.getDay(); // 0=Sun, 1=Mon, 6=Sat
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeekName = dayNames[dayOfWeek];
        const isWeekendOrMonday = dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 6;
        
        // Check if description contains daily/weekly/monthly
        const description = (wo["Description"] || "").toLowerCase();
        const isRoutine = description.includes("daily") || description.includes("weekly") || description.includes("monthly");
        
        return {
          ...wo,
          daysUntilCompliance,
          slack,
          dayOfWeekName,
          isWeekendOrMonday,
          isRoutine,
        };
      })
      .sort((a, b) => {
        // Sort by days until compliance first (ascending), then by data center
        const daysCompare = a.daysUntilCompliance - b.daysUntilCompliance;
        if (daysCompare !== 0) return daysCompare;
        return (a["Data Center"] || "").localeCompare(b["Data Center"] || "");
      });

    return filtered;
  }, [workOrders]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Compliance Check
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Work orders with compliance window ending within 15 days (weekly/monthly work orders only shown if due on upcoming Sat/Sun/Mon)
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-4">
            <strong>Total: {complianceData.length} work orders</strong>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Data Center</th>
                  <th className="py-3 px-4 text-left font-medium">Work Order</th>
                  <th className="py-3 px-4 text-left font-medium">Description</th>
                  <th className="py-3 px-4 text-left font-medium">Shift</th>
                  <th className="py-3 px-4 text-left font-medium">Assigned To</th>
                  <th className="py-3 px-4 text-left font-medium">Supervisor</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">Sched Start Date</th>
                  <th className="py-3 px-4 text-left font-medium">Sched End Date</th>
                  <th className="py-3 px-4 text-left font-medium">Compliance Window End</th>
                  <th className="py-3 px-4 text-left font-medium">Day of Week</th>
                  <th className="py-3 px-4 text-left font-medium">Days Until Compliance</th>
                  <th className="py-3 px-4 text-left font-medium">Slack (Days)</th>
                </tr>
              </thead>
              <tbody>
                {complianceData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-muted-foreground">
                      No work orders with compliance deadlines in the next 15 days
                    </td>
                  </tr>
                ) : (
                  complianceData.map((wo, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-border ${
                        wo.isWeekendOrMonday ? "bg-yellow-100 dark:bg-yellow-900/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4">{wo["Data Center"]}</td>
                      <td className="py-3 px-4">
                        <a
                          href={`https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=${wo["Work Order"]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {wo["Work Order"]}
                        </a>
                      </td>
                      <td className="py-3 px-4 truncate">{wo["Description"]}</td>
                      <td className="py-3 px-4">{wo["Shift"]}</td>
                      <td className="py-3 px-4">{wo["Assigned To Name"]}</td>
                      <td className="py-3 px-4">{wo["Supervisor"]}</td>
                      <td className="py-3 px-4">{wo["Status"]}</td>
                      <td className="py-3 px-4">
                        {wo["Sched. Start Date"]
                          ? new Date(wo["Sched. Start Date"]).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        {wo["Sched. End Date"]
                          ? new Date(wo["Sched. End Date"]).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        {new Date(wo["Compliance Window End Date"]).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {wo.dayOfWeekName}
                      </td>
                      <td
                        className={`py-3 px-4 font-semibold ${
                          wo.daysUntilCompliance <= 7 ? "text-red-600" : ""
                        }`}
                      >
                        {wo.daysUntilCompliance}
                      </td>
                      <td
                        className={`py-3 px-4 font-semibold ${
                          wo.slack !== null && wo.slack < 10 && !wo.isRoutine
                            ? "text-pink-600"
                            : ""
                        }`}
                      >
                        {wo.slack !== null ? wo.slack : "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p>
              <span className="inline-block w-4 h-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 mr-2"></span>
              Yellow highlight: Compliance ends on Saturday, Sunday, or Monday
            </p>
            <p>
              <span className="inline-block w-4 h-4 bg-red-600 mr-2"></span>
              Red number: 7 days or less until compliance deadline
            </p>
            <p>
              <span className="inline-block w-4 h-4 bg-pink-600 mr-2"></span>
              Pink number: Less than 10 days slack (excludes daily/weekly/monthly work orders)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
