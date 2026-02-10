/**
 * Swiss Rationalism: Clean data presentation for T2 week work orders not in Ready status
 */

import { useMemo } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, isT2Week, getT2WeekRange } from "@/lib/dateUtils";
import { getWorkWeekLeaders } from "@/lib/workWeekLeaders";

interface T2NotInReadyTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function T2NotInReadyTab({ workOrders }: T2NotInReadyTabProps) {
  const t2NotReadyOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isReady = wo["Status"]?.toUpperCase() === "READY";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      return !isCancelled && !isCMCC && !isReady && isT2Week(wo["Sched. Start Date"]);
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  if (t2NotReadyOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No T2 work orders found that are not in Ready status</p>
        </CardContent>
      </Card>
    );
  }

  // Get Work Week Leaders for T2 week
  const { start: t2Start } = getT2WeekRange();
  const weekLeaders = getWorkWeekLeaders(t2Start);

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-xl font-medium">T2 Not in Ready</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t2NotReadyOrders.length} work orders not in Ready status
        </p>
        {weekLeaders && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Work Week Leaders:</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span><span className="font-medium">COM:</span> {weekLeaders.COM}</span>
              <span><span className="font-medium">LBE:</span> {weekLeaders.LBE}</span>
              <span><span className="font-medium">SME Lead:</span> {weekLeaders.SMELead}</span>
              <span><span className="font-medium">cSME:</span> {weekLeaders.cSME}</span>
              <span><span className="font-medium">mSME:</span> {weekLeaders.mSME}</span>
              <span><span className="font-medium">eSME:</span> {weekLeaders.eSME}</span>
            </div>
          </div>
        )}
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
              </tr>
            </thead>
            <tbody>
              {t2NotReadyOrders.map((wo) => (
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
      </CardContent>
    </Card>
  );
}
