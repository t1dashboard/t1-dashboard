/**
 * Swiss Rationalism: Clean data presentation for work orders over 30 days with no deferral code
 */

import { useMemo } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";

interface WOsOver30DaysTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function WOsOver30DaysTab({ workOrders }: WOsOver30DaysTabProps) {
  const groupedOrders = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const filtered = workOrders.filter((wo) => {
      // Basic filters
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      
      // Type must be Corrective Maintenance
      const isCorrective = wo["Type"] === "Corrective Maintenance";
      
      // Status must be Planning or Ready to Schedule
      const status = wo["Status"]?.toUpperCase();
      const isValidStatus = status === "PLANNING" || status === "READY TO SCHEDULE";
      
      // Schedule start date must be <= 30 days ago (30+ days old)
      const schedDate = parseExcelDate(wo["Sched. Start Date"]);
      const isOlderThan30Days = schedDate && schedDate <= thirtyDaysAgo;
      
      // Deferral Reason Selected must be "NO" (no deferral code)
      const deferralCode = wo["Deferral Reason Selected"]?.toUpperCase();
      const hasDeferralNo = deferralCode === "NO";
      
      // Work order number must be numeric only (no letters)
      const woNumber = String(wo["Work Order"]);
      const isNumericOnly = /^\d+$/.test(woNumber);
      
      return !isCancelled && !isCMCC && isCorrective && isValidStatus && 
             isOlderThan30Days && hasDeferralNo && isNumericOnly;
    });
    
    // Group by data center
    const grouped = filtered.reduce((acc, wo) => {
      const dc = wo["Data Center"] || "Unknown";
      if (!acc[dc]) {
        acc[dc] = [];
      }
      acc[dc].push(wo);
      return acc;
    }, {} as Record<string, WorkOrder[]>);

    // Sort data centers alphabetically and sort work orders within each group
    const sortedGroups: Record<string, WorkOrder[]> = {};
    Object.keys(grouped)
      .sort()
      .forEach((dc) => {
        sortedGroups[dc] = grouped[dc].sort((a, b) => {
          return (a["Work Order"] || 0) - (b["Work Order"] || 0);
        });
      });

    return sortedGroups;
  }, [workOrders]);

  const totalCount = Object.values(groupedOrders).reduce((sum, orders) => sum + orders.length, 0);

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No work orders found matching the criteria
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{totalCount}</div>
            <div className="text-sm text-muted-foreground mt-2">Total Work Orders &gt;30 Days with No Deferral Code</div>
            <div className="text-xs text-muted-foreground mt-1">{Object.keys(groupedOrders).length} Data Centers</div>
          </div>
        </CardContent>
      </Card>
      {Object.entries(groupedOrders).map(([dataCenter, orders]) => (
        <Card key={dataCenter}>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">{dataCenter}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {orders.length} work order{orders.length !== 1 ? 's' : ''} &gt;30 days with no deferral code
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((wo, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      style={{ borderBottomWidth: '0.5px' }}
                    >
                      <td className="py-3 px-4">
                        <a
                          href={`${BASE_URL}${wo["Work Order"]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {wo["Work Order"]}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-sm">{wo["Description"]}</td>
                      <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. Start Date"])}</td>
                      <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                      <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
