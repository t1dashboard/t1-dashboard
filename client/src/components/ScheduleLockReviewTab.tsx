/**
 * Swiss Rationalism: Schedule Lock Review tab showing unplanned and incomplete locked work orders
 */

import { useMemo, useState, useEffect } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";
import { getWorkWeekLeaders } from "@/lib/workWeekLeaders";
import { getScheduleLocks, ScheduleLock } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface ScheduleLockReviewTabProps {
  workOrders: WorkOrder[];
}

interface LockedWorkOrder {
  workOrderNumber: string | number;
  description: string;
  dataCenter: string;
  schedStartDate: any;
  assignedTo: string;
  status: string;
  type: string;
  equipmentDescription: string;
  priority: string;
  shift: string;
  lockWeek: string;
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduleLockReviewTab({ workOrders }: ScheduleLockReviewTabProps) {
  const [serverLocks, setServerLocks] = useState<ScheduleLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(true);

  useEffect(() => {
    async function loadLocks() {
      try {
        const locks = await getScheduleLocks();
        setServerLocks(locks);
      } catch (error) {
        console.error("Error loading schedule locks:", error);
      } finally {
        setLoadingLocks(false);
      }
    }
    loadLocks();
  }, []);

  const { unplannedWorkOrders, incompleteLockedOrders } = useMemo(() => {
    // Get previous week's date range
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    // Use server locks instead of localStorage
    const lockedOrders: LockedWorkOrder[] = serverLocks.map(lock => ({
      workOrderNumber: lock.workOrderNumber,
      description: lock.description || "",
      dataCenter: lock.dataCenter || "",
      schedStartDate: lock.schedStartDate,
      assignedTo: lock.assignedTo || "",
      status: lock.status || "",
      type: lock.type || "",
      equipmentDescription: lock.equipmentDescription || "",
      priority: lock.priority || "",
      shift: lock.shift || "",
      lockWeek: lock.lockWeek
    }));
    
    // Filter for previous week's locked orders
    const previousWeekLocked = lockedOrders.filter(locked => {
      const lockDate = new Date(locked.lockWeek);
      return lockDate >= lastMonday && lockDate <= lastSunday;
    });

    const lockedWONumbers = new Set(previousWeekLocked.map(wo => String(wo.workOrderNumber)));

    // Find unplanned work orders (scheduled for previous week but not locked)
    const unplanned = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isWeekly = wo["Description"]?.toUpperCase().includes("WEEKLY");
      
      const schedDate = parseExcelDate(wo["Sched. Start Date"]);
      const isInPreviousWeek = schedDate && schedDate >= lastMonday && schedDate <= lastSunday;
      
      const woNumber = String(wo["Work Order"]);
      const wasNotLocked = !lockedWONumbers.has(woNumber);
      
      return !isCancelled && !isCMCC && !isWeekly && isInPreviousWeek && wasNotLocked;
    }).sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });

    // Find incomplete locked orders (locked but not Work Complete or Closed)
    const incomplete = previousWeekLocked.filter(locked => {
      // Find current status from work orders
      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
      if (!currentWO) return true; // If not found, consider incomplete
      
      const status = currentWO["Status"]?.toUpperCase() || "";
      return status !== "WORK COMPLETE" && status !== "CLOSED";
    }).sort((a, b) => {
      const dcA = a.dataCenter || "";
      const dcB = b.dataCenter || "";
      return dcA.localeCompare(dcB);
    });

    return {
      unplannedWorkOrders: unplanned,
      incompleteLockedOrders: incomplete
    };
  }, [workOrders, serverLocks]);

  // Get Work Week Leaders for previous week
  const previousWeekLeaders = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    return getWorkWeekLeaders(lastMonday);
  }, []);

  if (loadingLocks) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schedule lock data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unplanned Work Orders Section */}
      <div>
        <Card className="bg-destructive/5 border-destructive/20 mb-4">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-destructive">{unplannedWorkOrders.length}</div>
              <div className="text-sm text-muted-foreground mt-2">Unplanned Work Orders (Previous Week)</div>
              <div className="text-xs text-muted-foreground mt-1">Scheduled but not on locked list</div>
            </div>
          </CardContent>
        </Card>

        {unplannedWorkOrders.length > 0 ? (
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-medium">Unplanned Schedule Review</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Work orders scheduled for previous week that were not on the locked schedule
              </p>
              {previousWeekLeaders && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Previous Week Leaders:</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span><span className="font-medium">COM:</span> {previousWeekLeaders.COM}</span>
                    <span><span className="font-medium">LBE:</span> {previousWeekLeaders.LBE}</span>
                    <span><span className="font-medium">SME Lead:</span> {previousWeekLeaders.SMELead}</span>
                    <span><span className="font-medium">cSME:</span> {previousWeekLeaders.cSME}</span>
                    <span><span className="font-medium">mSME:</span> {previousWeekLeaders.mSME}</span>
                    <span><span className="font-medium">eSME:</span> {previousWeekLeaders.eSME}</span>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Equipment Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Priority</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unplannedWorkOrders.map((wo) => (
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
                            className="text-destructive hover:underline font-medium"
                          >
                            {wo["Work Order"]}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-sm">{wo["Description"]}</td>
                        <td className="py-3 px-4 text-sm">{wo["Type"]}</td>
                        <td className="py-3 px-4 text-sm">{wo["Equipment Description"]}</td>
                        <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                        <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                        <td className="py-3 px-4 text-sm">{wo["Priority"]}</td>
                        <td className="py-3 px-4 text-sm">{wo["Shift"]}</td>
                        <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                        <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. Start Date"])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No unplanned work orders from previous week</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Incomplete Locked Orders Section */}
      <div>
        <Card className="bg-primary/5 border-primary/20 mb-4">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{incompleteLockedOrders.length}</div>
              <div className="text-sm text-muted-foreground mt-2">Incomplete Locked Work Orders</div>
              <div className="text-xs text-muted-foreground mt-1">Not in Work Complete or Closed status</div>
            </div>
          </CardContent>
        </Card>

        {incompleteLockedOrders.length > 0 ? (
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-medium">Locked Schedule Review</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Previous week's locked work orders not yet completed or closed
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Equipment Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Priority</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompleteLockedOrders.map((locked) => {
                      // Get current status from work orders
                      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
                      const currentStatus = currentWO?.["Status"] || locked.status;
                      
                      return (
                        <tr 
                          key={locked.workOrderNumber} 
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          style={{ borderBottomWidth: '0.5px' }}
                        >
                          <td className="py-3 px-4">
                            <a
                              href={`${BASE_URL}${locked.workOrderNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium"
                            >
                              {locked.workOrderNumber}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm">{locked.description}</td>
                          <td className="py-3 px-4 text-sm">{locked.type}</td>
                          <td className="py-3 px-4 text-sm">{locked.equipmentDescription}</td>
                          <td className="py-3 px-4 text-sm">{currentStatus}</td>
                          <td className="py-3 px-4 text-sm font-medium">{locked.dataCenter}</td>
                          <td className="py-3 px-4 text-sm">{locked.priority}</td>
                          <td className="py-3 px-4 text-sm">{locked.shift}</td>
                          <td className="py-3 px-4 text-sm">{locked.assignedTo}</td>
                          <td className="py-3 px-4 text-sm">{formatDate(locked.schedStartDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">All locked work orders from previous week are complete or closed</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
