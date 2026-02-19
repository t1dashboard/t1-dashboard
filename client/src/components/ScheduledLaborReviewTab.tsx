/**
 * Scheduled Labor Review Tab: Analyzes work orders from the scheduled labor file
 */

import { useMemo } from "react";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ScheduledLaborReviewTabProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduledLaborReviewTab({ workOrders, scheduledLabor }: ScheduledLaborReviewTabProps) {
  const scheduledLaborAnalysis = useMemo(() => {
    // Create a set of work order numbers from scheduled labor
    const scheduledWONumbers = new Set(scheduledLabor.map(sl => String(sl.workOrderNumber)));

    // Find matching work orders with Ready status and remove duplicates
    const uniqueWorkOrders = new Map<string, WorkOrder>();
    
    workOrders.forEach(wo => {
      const woNumber = String(wo["Work Order"]);
      const status = (wo["Status"] || "").toUpperCase();
      if (scheduledWONumbers.has(woNumber) && !uniqueWorkOrders.has(woNumber) && status === "READY") {
        uniqueWorkOrders.set(woNumber, wo);
      }
    });

    const matchedWorkOrders = Array.from(uniqueWorkOrders.values());

    // Group by assigned person, then sort by person name
    const groupedByPerson = new Map<string, WorkOrder[]>();
    matchedWorkOrders.forEach(wo => {
      const assignedTo = wo["Assigned To Name"] || "Unassigned";
      if (!groupedByPerson.has(assignedTo)) {
        groupedByPerson.set(assignedTo, []);
      }
      groupedByPerson.get(assignedTo)!.push(wo);
    });

    // Sort persons alphabetically and their work orders by data center
    const sortedGroups = Array.from(groupedByPerson.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([person, wos]) => ({
        person,
        workOrders: wos.sort((a, b) => {
          const dcA = a["Data Center"] || "";
          const dcB = b["Data Center"] || "";
          return dcA.localeCompare(dcB);
        })
      }));

    return {
      groups: sortedGroups,
      totalCount: matchedWorkOrders.length
    };
  }, [workOrders, scheduledLabor]);

  const getStatusColor = (status: string): string => {
    const statusUpper = status?.toUpperCase() || "";
    if (statusUpper === "READY") return "text-red-600 font-semibold";
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Labor Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="text-2xl font-bold text-red-600">{scheduledLaborAnalysis.totalCount}</div>
              <div className="text-sm text-muted-foreground">Work Orders in Ready Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Work Orders Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">
            Work orders from the scheduled labor file with Ready status only
          </p>
        </CardHeader>
        <CardContent>
          {scheduledLaborAnalysis.groups.length > 0 ? (
            <div className="space-y-6">
              {scheduledLaborAnalysis.groups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  <h3 className="font-semibold text-lg mb-3 text-primary">
                    {group.person} ({group.workOrders.length} work orders)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "60%" }} />
                        <col style={{ width: "16%" }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Data Center</th>
                          <th className="text-left p-2">Work Order</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.workOrders.map((wo, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="p-2">{wo["Data Center"]}</td>
                            <td className="p-2">
                              <a
                                href={`${BASE_URL}${wo["Work Order"]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {wo["Work Order"]}
                              </a>
                            </td>
                            <td className="p-2">{wo["Description"]}</td>
                            <td className="p-2">
                              <span className={getStatusColor(wo["Status"] || "")}>
                                {wo["Status"] || "Unknown"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No work orders found in scheduled labor file
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
