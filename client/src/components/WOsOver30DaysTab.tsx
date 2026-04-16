/**
 * Swiss Rationalism: Clean data presentation for work orders over 30 days with no deferral code
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";

interface WOsOver30DaysTabProps {
  workOrders: WorkOrder[];
  commentsMap?: Record<string, { comment: string; date: string | null }>;
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function WOsOver30DaysTab({ workOrders, commentsMap = {} }: WOsOver30DaysTabProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (woNum: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(woNum)) next.delete(woNum);
      else next.add(woNum);
      return next;
    });
  };

  const groupedOrders = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isCorrective = wo["Type"] === "Corrective Maintenance";
      const status = wo["Status"]?.toUpperCase();
      const isValidStatus = status === "PLANNING" || status === "READY TO SCHEDULE";
      const schedDate = parseExcelDate(wo["Sched. Start Date"]);
      const isOlderThan30Days = schedDate && schedDate <= thirtyDaysAgo;
      const deferralCode = (wo["Deferral Reason Selected"] || "").trim().toUpperCase();
      const hasDeferralNo = deferralCode === "NO" || deferralCode === "";
      const woNumber = String(wo["Work Order"]);
      const isNumericOnly = /^\d+$/.test(woNumber);
      
      return !isCancelled && !isCMCC && isCorrective && isValidStatus && 
             isOlderThan30Days && hasDeferralNo && isNumericOnly;
    });
    
    const grouped = filtered.reduce((acc, wo) => {
      const dc = wo["Data Center"] || "Unknown";
      if (!acc[dc]) acc[dc] = [];
      acc[dc].push(wo);
      return acc;
    }, {} as Record<string, WorkOrder[]>);

    const sortedGroups: Record<string, WorkOrder[]> = {};
    Object.keys(grouped)
      .sort()
      .forEach((dc) => {
        sortedGroups[dc] = grouped[dc].sort((a, b) => {
          const dateA = parseExcelDate(a["Sched. Start Date"]);
          const dateB = parseExcelDate(b["Sched. Start Date"]);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime();
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
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Supervisor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Most Recent Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((wo) => {
                    const woNum = String(wo["Work Order"]);
                    const commentData = commentsMap?.[woNum];
                    const comment = commentData?.comment || "N/A";
                    const commentDate = commentData?.date || null;
                    const isExpanded = expandedRows.has(woNum);
                    return (
                      <>
                        <tr 
                          key={woNum} 
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                          style={{ borderBottomWidth: isExpanded ? '0px' : '0.5px' }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('a')) return;
                            toggleRow(woNum);
                          }}
                        >
                          <td className="py-3 px-4">
                            <a
                              href={`${BASE_URL}${woNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {woNum}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm truncate">{wo["Description"]}</td>
                          <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. Start Date"])}</td>
                          <td className="py-3 px-4 text-sm truncate">{wo["Shift"]}</td>
                          <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                          <td className="py-3 px-4 text-sm">{wo["Supervisor"]}</td>
                          <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                          <td className="py-3 px-4 text-sm truncate text-muted-foreground" title={comment}>
                            {comment}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${woNum}-expanded`} className="border-b border-border/50 bg-muted/10" style={{ borderBottomWidth: '0.5px' }}>
                            <td colSpan={8} className="py-3 px-4">
                              <div className="text-sm">
                                <span className="font-medium text-foreground">Full Comment: </span>
                                <span className="text-muted-foreground">{comment}</span>
                              </div>
                              {commentDate && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium text-foreground">Comment Date: </span>
                                  <span>{commentDate}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
