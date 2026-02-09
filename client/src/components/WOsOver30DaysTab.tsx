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
      
      // Trade must not be CFT (if Trade column exists)
      let isNotCFT = true;
      if (wo["Trade"]) {
        const trade = wo["Trade"]?.toUpperCase();
        isNotCFT = trade !== "CFT";
      }
      
      // Shift must NOT equal GNSF
      const shift = wo["Shift"]?.toUpperCase();
      const isNotGNSF = shift !== "GNSF";
      
      // Work order number must be numeric only (no letters)
      const woNumber = String(wo["Work Order"]);
      const isNumericOnly = /^\d+$/.test(woNumber);
      
      return !isCancelled && !isCMCC && isCorrective && isValidStatus && 
             isOlderThan30Days && hasDeferralNo && isNotCFT && isNotGNSF && isNumericOnly;
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
        <CardContent className="py-12 text-center text-muted-foreground">
          No work orders found matching the criteria
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-medium">
          Work Orders &gt;30 Days with No Deferral Code ({over30DaysOrders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Work Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Description</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data Center</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sched Start Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Assigned To</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {over30DaysOrders.map((wo, index) => (
                <tr key={index} className="border-b border-border hover:bg-muted/50">
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
                  <td className="py-3 px-4 text-sm">{wo["Data Center"]}</td>
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
  );
}
