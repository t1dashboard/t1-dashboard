/**
 * Swiss Rationalism: Clean data presentation for work orders over 90 days with deferral code
 */

import { useMemo } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dateUtils";
import { isOlderThanDays } from "@/lib/t4t8DateUtils";

interface WOsOver90DaysTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function WOsOver90DaysTab({ workOrders }: WOsOver90DaysTabProps) {
  const over90DaysOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const hasDeferralCode = wo["Deferral Reason Selected"] && wo["Deferral Reason Selected"] !== "";
      const isOld = isOlderThanDays(wo["Date Created"], 90);
      
      return !isCancelled && !isCMCC && hasDeferralCode && isOld;
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  if (over90DaysOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No work orders found over 90 days with a deferral code</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-xl font-medium">&gt;90 Days with Deferral Code</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {over90DaysOrders.length} work orders over 90 days with deferral code
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Date Created</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Deferral Reason</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Supervisor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {over90DaysOrders.map((wo) => (
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
                    {formatDate(wo["Date Created"])}
                  </td>
                  <td className="py-3 px-4 text-sm">{wo["Deferral Reason Selected"]}</td>
                  <td className="py-3 px-4 text-sm">{wo["Shift"]}</td>
                  <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                  <td className="py-3 px-4 text-sm">{wo["Supervisor"]}</td>
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
