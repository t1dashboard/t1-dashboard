/**
 * Swiss Rationalism: Clean data presentation for T4-T8 week work orders not in Approved status
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dateUtils";
import { isT4T8Week } from "@/lib/t4t8DateUtils";
import DataCenterFilter from "@/components/DataCenterFilter";

interface T4T8NotInApprovedTabProps {
  workOrders: WorkOrder[];
  commentsMap: Record<string, string>;
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function T4T8NotInApprovedTab({ workOrders, commentsMap }: T4T8NotInApprovedTabProps) {
  const [selectedDCs, setSelectedDCs] = useState<Set<string>>(new Set());

  const groupedOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const status = wo["Status"]?.toUpperCase() || "";
      const isCancelled = status === "CANCELLED";
      const isClosed = status === "CLOSED";
      const isInProcess = status === "IN PROCESS";
      const isPlanning = status === "PLANNING";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      return !isCancelled && !isClosed && !isInProcess && !isCMCC && isPlanning && isT4T8Week(wo["Sched. Start Date"]);
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

  // Get all unique data centers
  const allDataCenters = useMemo(() => Object.keys(groupedOrders), [groupedOrders]);

  // Apply data center filter
  const filteredGroupedOrders = useMemo(() => {
    if (selectedDCs.size === 0) return groupedOrders;
    const filtered: Record<string, WorkOrder[]> = {};
    for (const [dc, orders] of Object.entries(groupedOrders)) {
      if (selectedDCs.has(dc)) {
        filtered[dc] = orders;
      }
    }
    return filtered;
  }, [groupedOrders, selectedDCs]);

  const filteredTotalCount = Object.values(filteredGroupedOrders).reduce((sum, orders) => sum + orders.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{filteredTotalCount}</div>
            <div className="text-sm text-muted-foreground mt-2">
              Total Work Orders Not in Approved Status
              {selectedDCs.size > 0 && (
                <span className="text-xs ml-1">(filtered from {totalCount} total)</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{Object.keys(filteredGroupedOrders).length} Data Centers</div>
          </div>
          {allDataCenters.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <DataCenterFilter
                dataCenters={allDataCenters}
                selected={selectedDCs}
                onChange={setSelectedDCs}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {filteredTotalCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {selectedDCs.size > 0
                ? "No work orders match the selected data center filter"
                : "No T4-T8 work orders found that are not in Approved status"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
      {Object.entries(filteredGroupedOrders).map(([dataCenter, orders]) => (
        <Card key={dataCenter}>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-medium">{dataCenter}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {orders.length} work order{orders.length !== 1 ? 's' : ''} not in Approved status
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "27%" }} />
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
                  {orders.map((wo) => (
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
                      <td className="py-3 px-4 text-sm">
                        {formatDate(wo["Sched. Start Date"])}
                      </td>
                      <td className="py-3 px-4 text-sm">{wo["Shift"]}</td>
                      <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                      <td className="py-3 px-4 text-sm">{wo["Supervisor"]}</td>
                      <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground truncate" title={commentsMap[String(wo["Work Order"])] || ""}>{commentsMap[String(wo["Work Order"])] || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
        </>
      )}
    </div>
  );
}
