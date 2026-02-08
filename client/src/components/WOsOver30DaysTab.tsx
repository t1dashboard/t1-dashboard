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
  const over30DaysOrders = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const filtered = workOrders.filter((wo) => {
      // Basic filters
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      
      // Type Code must be corrective
      const isCorrective = wo["Type Code"]?.toUpperCase().includes("CORRECTIVE");
      
      // Status must be Planning or Ready to Schedule
      const status = wo["Status"]?.toUpperCase();
      const isValidStatus = status === "PLANNING" || status === "READY TO SCHEDULE";
      
      // Schedule start date must be >30 days from today
      const schedDate = parseExcelDate(wo["Sched. Start Date"]);
      const isOver30Days = schedDate && schedDate > thirtyDaysFromNow;
      
      // Deferral Code Selected must be "No"
      const deferralCode = wo["Deferral Reason Selected"]?.toUpperCase();
      const hasDeferralNo = deferralCode === "NO";
      
      // Trade must not be CFT
      const trade = wo["Trade"]?.toUpperCase();
      const isNotCFT = trade !== "CFT";
      
      // Shift must equal GNSF
      const shift = wo["Shift"]?.toUpperCase();
      const isGNSF = shift === "GNSF";
      
      // Work order number must be numeric only (no letters)
      const woNumber = String(wo["Work Order"]);
      const isNumericOnly = /^\d+$/.test(woNumber);
      
      return !isCancelled && !isCMCC && isCorrective && isValidStatus && 
             isOver30Days && hasDeferralNo && isNotCFT && isGNSF && isNumericOnly;
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  if (over30DaysOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No work orders found over 30 days without a deferral code</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-xl font-medium">WOs &gt;30 Days with no Deferral Code</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {over30DaysOrders.length} work orders over 30 days without deferral code
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
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Date Created</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {over30DaysOrders.map((wo) => (
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
                    {formatDate(wo["Date Created"])}
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
