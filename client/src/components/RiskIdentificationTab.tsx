/**
 * Swiss Rationalism: Clean data presentation with status indicators
 */

import { useMemo } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RiskIdentificationTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function RiskIdentificationTab({ workOrders }: RiskIdentificationTabProps) {
  const riskWorkOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const ehsLOR = wo["EHS LOR"];
      const opLOR = wo["Operational LOR"];
      return (
        ehsLOR === "Medium" || ehsLOR === "High" ||
        opLOR === "Medium" || opLOR === "High"
      );
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  const getLORBadgeVariant = (lor: string): "default" | "destructive" | "secondary" => {
    if (lor === "High") return "destructive";
    if (lor === "Medium") return "default";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-xl font-medium">Risk Identification</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {riskWorkOrders.length} work orders with Medium or High LOR
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
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">EHS LOR</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Operational LOR</th>
              </tr>
            </thead>
            <tbody>
              {riskWorkOrders.map((wo) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
