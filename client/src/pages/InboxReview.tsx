/**
 * Inbox Review: Contains WO Campaign, Scheduled Labor Review, and WOs Awaiting Closure sub-tabs
 */

import { useState, useMemo } from "react";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";
import ScheduledLaborReviewTab from "@/components/ScheduledLaborReviewTab";

interface InboxReviewProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function InboxReview({ workOrders, scheduledLabor }: InboxReviewProps) {
  const [activeTab, setActiveTab] = useState("wo-campaign");

  // WO Campaign: filter work orders whose description contains "WO Campaign" (case-insensitive)
  // Group by similar description, sort by sched start date (oldest first) within each group
  const woCampaignGroups = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const desc = (wo["Description"] || "").toUpperCase();
      return desc.includes("WO CAMPAIGN");
    });

    // Group by description
    const groups = new Map<string, WorkOrder[]>();
    filtered.forEach((wo) => {
      const desc = wo["Description"] || "Unknown";
      if (!groups.has(desc)) {
        groups.set(desc, []);
      }
      groups.get(desc)!.push(wo);
    });

    // Sort WOs within each group by sched start date (oldest first)
    const sortBySchedStart = (a: WorkOrder, b: WorkOrder) => {
      const dateA = parseExcelDate(a["Sched. Start Date"]);
      const dateB = parseExcelDate(b["Sched. Start Date"]);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    };

    // Sort groups by earliest sched start date in each group
    const sortedGroups = Array.from(groups.entries())
      .map(([desc, wos]) => ({
        description: desc,
        workOrders: wos.sort(sortBySchedStart)
      }))
      .sort((a, b) => {
        const dateA = parseExcelDate(a.workOrders[0]?.["Sched. Start Date"]);
        const dateB = parseExcelDate(b.workOrders[0]?.["Sched. Start Date"]);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });

    return sortedGroups;
  }, [workOrders]);

  const woCampaignTotal = useMemo(() => {
    return woCampaignGroups.reduce((sum, g) => sum + g.workOrders.length, 0);
  }, [woCampaignGroups]);

  // WOs Awaiting Closure: Work Complete status + Deferral Reason Selected = "No"
  const awaitingClosureOrders = useMemo(() => {
    return workOrders
      .filter((wo) => {
        const status = (wo["Status"] || "").toUpperCase();
        const deferral = (wo["Deferral Reason Selected"] || "").toUpperCase().trim();
        const isWorkComplete = status === "WORK COMPLETE" || status === "WORKCOMPLETE";
        const deferralNo = deferral === "NO";
        return isWorkComplete && deferralNo;
      })
      .sort((a, b) => {
        const woA = Number(a["Work Order"]) || 0;
        const woB = Number(b["Work Order"]) || 0;
        return woA - woB;
      });
  }, [workOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Inbox Review</h2>
        <p className="text-sm text-muted-foreground mt-1">Review work order campaigns, scheduled labor, and work orders awaiting closure</p>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wo-campaign" className="flex items-center gap-2">
            WO Campaign
            <Badge variant="secondary" className="text-xs">{woCampaignTotal}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduled-labor" className="flex items-center gap-2">
            Scheduled Labor Review
          </TabsTrigger>
          <TabsTrigger value="awaiting-closure" className="flex items-center gap-2">
            WOs Awaiting Closure
            <Badge variant="secondary" className="text-xs">{awaitingClosureOrders.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* WO Campaign Tab */}
        <TabsContent value="wo-campaign" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>WO Campaign</CardTitle>
              <p className="text-sm text-muted-foreground">
                {woCampaignTotal} work orders with "WO Campaign" in description, grouped by description, sorted by sched start date (oldest first)
              </p>
            </CardHeader>
            <CardContent>
              {woCampaignGroups.length > 0 ? (
                <div className="space-y-6">
                  {woCampaignGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                      <h3 className="font-semibold text-base mb-3 text-primary">
                        {group.description} ({group.workOrders.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "20%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "15%" }} />
                            <col style={{ width: "15%" }} />
                            <col style={{ width: "15%" }} />
                            <col style={{ width: "15%" }} />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left py-3 px-4 font-medium">Work Order</th>
                              <th className="text-left py-3 px-4 font-medium">Description</th>
                              <th className="text-left py-3 px-4 font-medium">Data Center</th>
                              <th className="text-left py-3 px-4 font-medium">Assigned To</th>
                              <th className="text-left py-3 px-4 font-medium">Sched Start Date</th>
                              <th className="text-left py-3 px-4 font-medium">Sched End Date</th>
                              <th className="text-left py-3 px-4 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.workOrders.map((wo) => (
                              <tr key={wo["Work Order"]} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                <td className="py-3 px-4">
                                  <a
                                    href={`${BASE_URL}${wo["Work Order"]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-mono"
                                  >
                                    {wo["Work Order"]}
                                  </a>
                                </td>
                                <td className="py-3 px-4 truncate">{wo["Description"]}</td>
                                <td className="py-3 px-4 font-medium">{wo["Data Center"]}</td>
                                <td className="py-3 px-4">{wo["Assigned To Name"]}</td>
                                <td className="py-3 px-4">{formatDate(wo["Sched. Start Date"])}</td>
                                <td className="py-3 px-4">{formatDate(wo["Sched. End Date"])}</td>
                                <td className="py-3 px-4">{wo["Status"]}</td>
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
                  No work orders found with "WO Campaign" in description
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Labor Review Tab */}
        <TabsContent value="scheduled-labor" className="mt-6">
          <ScheduledLaborReviewTab workOrders={workOrders} scheduledLabor={scheduledLabor} />
        </TabsContent>

        {/* WOs Awaiting Closure Tab */}
        <TabsContent value="awaiting-closure" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>WOs Awaiting Closure</CardTitle>
              <p className="text-sm text-muted-foreground">
                {awaitingClosureOrders.length} work orders in "Work Complete" status with Deferral Reason Selected = "No"
              </p>
            </CardHeader>
            <CardContent>
              {awaitingClosureOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "14%" }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium">Work Order</th>
                        <th className="text-left py-3 px-4 font-medium">Description</th>
                        <th className="text-left py-3 px-4 font-medium">Data Center</th>
                        <th className="text-left py-3 px-4 font-medium">Supervisor</th>
                        <th className="text-left py-3 px-4 font-medium">Sched Start Date</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Deferral Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awaitingClosureOrders.map((wo) => (
                        <tr key={wo["Work Order"]} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <a
                              href={`${BASE_URL}${wo["Work Order"]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-mono"
                            >
                              {wo["Work Order"]}
                            </a>
                          </td>
                          <td className="py-3 px-4">{wo["Description"]}</td>
                          <td className="py-3 px-4 font-medium">{wo["Data Center"]}</td>
                          <td className="py-3 px-4">{wo["Supervisor"] || "—"}</td>
                          <td className="py-3 px-4">{formatDate(wo["Sched. Start Date"])}</td>
                          <td className="py-3 px-4">{wo["Status"]}</td>
                          <td className="py-3 px-4">{wo["Deferral Reason Selected"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No work orders found in "Work Complete" status with Deferral Reason = "No"
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
