/**
 * Swiss Rationalism: Clean data presentation for T1 week work orders not in Ready status
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, isNextWeek, getNextWeekRange } from "@/lib/dateUtils";
import { getWorkWeekLeaders } from "@/lib/workWeekLeaders";
import DataCenterFilter from "@/components/DataCenterFilter";

interface T1NotInReadyTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function T1NotInReadyTab({ workOrders }: T1NotInReadyTabProps) {
  const [selectedDCs, setSelectedDCs] = useState<Set<string>>(new Set());

  const t1NotReadyOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const status = wo["Status"]?.toUpperCase() || "";
      const isCancelled = status === "CANCELLED";
      const isClosed = status === "CLOSED";
      const isReady = status === "READY";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      return !isCancelled && !isClosed && !isCMCC && !isReady && isNextWeek(wo["Sched. Start Date"]);
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  // Get all unique data centers from the filtered orders
  const allDataCenters = useMemo(() => {
    const dcs = new Set<string>();
    t1NotReadyOrders.forEach((wo) => {
      if (wo["Data Center"]) dcs.add(wo["Data Center"]);
    });
    return Array.from(dcs);
  }, [t1NotReadyOrders]);

  // Apply data center filter
  const filteredOrders = useMemo(() => {
    if (selectedDCs.size === 0) return t1NotReadyOrders;
    return t1NotReadyOrders.filter((wo) => selectedDCs.has(wo["Data Center"]));
  }, [t1NotReadyOrders, selectedDCs]);

  // Get Work Week Leaders for T1 week - always compute, regardless of work order count
  const { start: t1Start } = getNextWeekRange();
  const weekLeaders = getWorkWeekLeaders(t1Start);

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-xl font-medium">T1 Not in Ready</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {filteredOrders.length} work order{filteredOrders.length !== 1 ? "s" : ""} not in Ready status
          {selectedDCs.size > 0 && (
            <span className="text-xs ml-1">(filtered from {t1NotReadyOrders.length} total)</span>
          )}
        </p>
        {weekLeaders && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Work Week Leaders:</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span><span className="font-semibold">COM:</span> {weekLeaders.COM}</span>
              <span><span className="font-semibold">LBE:</span> {weekLeaders.LBE}</span>
              <span><span className="font-semibold">SME Lead:</span> {weekLeaders.SME}</span>
              <span><span className="font-semibold">cSME:</span> {weekLeaders.cSME}</span>
              <span><span className="font-semibold">mSME:</span> {weekLeaders.mSME}</span>
              <span><span className="font-semibold">eSME:</span> {weekLeaders.eSME}</span>
            </div>
          </div>
        )}
        {allDataCenters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <DataCenterFilter
              dataCenters={allDataCenters}
              selected={selectedDCs}
              onChange={setSelectedDCs}
            />
          </div>
        )}
      </CardHeader>

      {filteredOrders.length === 0 ? (
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            {selectedDCs.size > 0
              ? "No work orders match the selected data center filter"
              : "No T1 work orders found that are not in Ready status"}
          </p>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "9%" }} />
                <col style={{ width: "33%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((wo) => (
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
                    <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
