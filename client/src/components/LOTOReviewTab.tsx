/**
 * Swiss Rationalism: Status indicators with functional color coding
 * Green for Yes (labor scheduled), Red for No (labor not scheduled)
 */

import { useMemo } from "react";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LOTOReviewTabProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function LOTOReviewTab({ workOrders, scheduledLabor }: LOTOReviewTabProps) {
  const lotoWorkOrders = useMemo(() => {
    // Filter work orders containing LOTO or PTW in description
    const filtered = workOrders.filter((wo) => {
      const desc = wo["Description"]?.toUpperCase() || "";
      return desc.includes("LOTO") || desc.includes("PTW");
    });

    // Sort alphabetically by data center
    filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });

    // Create a set of work order numbers from scheduled labor
    const scheduledSet = new Set(scheduledLabor.map(sl => sl.workOrderNumber));

    // Add scheduled labor status
    return filtered.map((wo) => ({
      ...wo,
      allScheduledLabor: !scheduledSet.has(wo["Work Order"]) // If in scheduled labor list, mark as No
    }));
  }, [workOrders, scheduledLabor]);

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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
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
                  <td className="py-3 px-4 text-sm">{wo["Description"]}</td>
                  <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                  <td className="py-3 px-4 text-sm">
                    {new Date(wo["Sched. Start Date"]).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
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
