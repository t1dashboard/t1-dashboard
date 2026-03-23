/**
 * Swiss Rationalism: Status indicators with functional color coding
 * Green for Yes (labor scheduled), Red for No (labor not scheduled)
 */

import { useMemo } from "react";
import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, isNextWeek } from "@/lib/dateUtils";

interface LOTOReviewTabProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
  pmCodes: PMCode[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function LOTOReviewTab({ workOrders, scheduledLabor, pmCodes }: LOTOReviewTabProps) {
  const lotoWorkOrders = useMemo(() => {
    // Create a set of PM codes that require LOTO or PTW
    const lotoPTWCodes = new Set(
      pmCodes
        .filter(pm => {
          const lotoReq = (pm["LOTO Required"] || "").toUpperCase();
          const ptwReq = (pm["PTW Required"] || "").toUpperCase();
          return lotoReq === "YES" || ptwReq === "YES";
        })
        .map(pm => pm["PM Codes"])
    );

    // Filter work orders containing LOTO or PTW in description OR matching PM codes, and scheduled for next week, excluding cancelled, CMCC, and weekly
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const desc = wo["Description"]?.toUpperCase() || "";
      const isCMCC = desc.includes("CMCC");
      const isWeekly = desc.includes("WEEKLY");
      const isDockLevelerQuarterly = desc.includes("DOCK LEVELER QUARTERLY");
      const isNFPA110ThreeYearPM = desc.includes("NFPA110 EMERGENCY GENERATOR THREE YEAR PM");
      const hasLOTOorPTW = desc.includes("LOTO") || desc.includes("PTW");
      const pmCode = wo["PM Code"] || "";
      const hasPMCodeMatch = lotoPTWCodes.has(pmCode);
      
      return !isCancelled && !isCMCC && !isWeekly && !isDockLevelerQuarterly && !isNFPA110ThreeYearPM && (hasLOTOorPTW || hasPMCodeMatch) && isNextWeek(wo["Sched. Start Date"]);
    });

    // Sort alphabetically by data center
    filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });

    // Create a set of work order numbers from scheduled labor (convert to strings for comparison)
    const scheduledSet = new Set(scheduledLabor.map(sl => String(sl.workOrderNumber)));

    // Add scheduled labor status
    return filtered.map((wo) => ({
      ...wo,
      allScheduledLabor: !scheduledSet.has(String(wo["Work Order"])) // If in scheduled labor list, mark as No
    }));
  }, [workOrders, scheduledLabor, pmCodes]);

  const getLORBadgeVariant = (lor: string): "default" | "destructive" | "secondary" => {
    if (lor === "High") return "destructive";
    if (lor === "Medium") return "default";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-xl font-medium">LOTO Review</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {lotoWorkOrders.length} work orders with LOTO or PTW requirements
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Supervisor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">EHS LOR</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Operational LOR</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">All Scheduled Labor</th>
              </tr>
            </thead>
            <tbody>
              {lotoWorkOrders.map((wo) => (
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
                  <td className="py-3 px-4 text-sm truncate">{wo["Description"]}</td>
                  <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                  <td className="py-3 px-4 text-sm">
                    {formatDate(wo["Sched. Start Date"])}
                  </td>
                  <td className="py-3 px-4 text-sm">{wo["Shift"]}</td>
                  <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                  <td className="py-3 px-4 text-sm">{wo["Supervisor"]}</td>
                  <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                  <td className="py-3 px-4">
                    <Badge variant={getLORBadgeVariant(wo["EHS LOR"])} className="text-xs">
                      {wo["EHS LOR"]}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={getLORBadgeVariant(wo["Operational LOR"])} className="text-xs">
                      {wo["Operational LOR"]}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      className="text-xs font-medium"
                      style={{
                        backgroundColor: wo.allScheduledLabor ? "oklch(0.60 0.12 150)" : "oklch(0.50 0.15 25)",
                        color: "white"
                      }}
                    >
                      {wo.allScheduledLabor ? "Yes" : "No"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
