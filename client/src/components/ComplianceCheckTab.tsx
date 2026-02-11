import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkOrder } from "@/types/workOrder";
import { AlertTriangle } from "lucide-react";

interface ComplianceCheckTabProps {
  workOrders: WorkOrder[];
}

export default function ComplianceCheckTab({ workOrders }: ComplianceCheckTabProps) {
  const complianceData = useMemo(() => {
    // Normalize to start of today for comparison
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const filtered = workOrders
      .filter((wo) => {
        const complianceEnd = wo["Compliance Window End Date"];
        if (!complianceEnd) return false;

        const complianceDate = new Date(complianceEnd);
        // Normalize compliance date to midnight
        complianceDate.setHours(0, 0, 0, 0);
        
        return complianceDate >= now && complianceDate <= thirtyDaysFromNow;
      })
      .map((wo) => {
        const complianceEnd = new Date(wo["Compliance Window End Date"]);
        const schedStart = wo["Sched. Start Date"] ? new Date(wo["Sched. Start Date"]) : null;
        
        // Calculate days until compliance
        const daysUntilCompliance = Math.ceil((complianceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate slack (days between sched start and compliance end)
        const slack = schedStart 
          ? Math.ceil((complianceEnd.getTime() - schedStart.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        // Check if compliance ends on Sat/Sun/Mon
        const dayOfWeek = complianceEnd.getDay(); // 0=Sun, 1=Mon, 6=Sat
        const isWeekendOrMonday = dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 6;
        
        // Check if description contains daily/weekly/monthly
        const description = (wo["Description"] || "").toLowerCase();
        const isRoutine = description.includes("daily") || description.includes("weekly") || description.includes("monthly");
        
        return {
          ...wo,
          daysUntilCompliance,
          slack,
          isWeekendOrMonday,
          isRoutine,
        };
      })
      .sort((a, b) => {
        // Sort by data center, then by days until compliance
        const dcCompare = (a["Data Center"] || "").localeCompare(b["Data Center"] || "");
        if (dcCompare !== 0) return dcCompare;
        return a.daysUntilCompliance - b.daysUntilCompliance;
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
            Work orders with compliance window ending within 30 days
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-4">
            <strong>Total: {complianceData.length} work orders</strong>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Data Center</th>
                  <th className="py-3 px-4 text-left font-medium">Work Order</th>
                  <th className="py-3 px-4 text-left font-medium">Description</th>
                  <th className="py-3 px-4 text-left font-medium">Assigned To</th>
                  <th className="py-3 px-4 text-left font-medium">Sched Start Date</th>
                  <th className="py-3 px-4 text-left font-medium">Sched End Date</th>
                  <th className="py-3 px-4 text-left font-medium">Compliance Window End</th>
                  <th className="py-3 px-4 text-left font-medium">Days Until Compliance</th>
                  <th className="py-3 px-4 text-left font-medium">Slack (Days)</th>
                </tr>
              </thead>
              <tbody>
                {complianceData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No work orders with compliance deadlines in the next 30 days
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
                      <td className="py-3 px-4">{wo["Work Order"]}</td>
                      <td className="py-3 px-4">{wo["Description"]}</td>
                      <td className="py-3 px-4">{wo["Assigned To Name"]}</td>
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
