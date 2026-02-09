/**
 * Swiss Rationalism: Schedule Lock tab for selecting and locking T1 work orders
 */

import { useState, useMemo, useEffect } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, isNextWeek } from "@/lib/dateUtils";
import { toast } from "sonner";

interface ScheduleLockTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduleLockTab({ workOrders }: ScheduleLockTabProps) {
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const t1WorkOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      return !isCancelled && !isCMCC && isNextWeek(wo["Sched. Start Date"]);
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWorkOrders(new Set());
    } else {
      const allIds = new Set(t1WorkOrders.map(wo => String(wo["Work Order"])));
      setSelectedWorkOrders(allIds);
    }
    setSelectAll(!selectAll);
  };

  const handleToggleWorkOrder = (woNumber: string) => {
    const newSelected = new Set(selectedWorkOrders);
    if (newSelected.has(woNumber)) {
      newSelected.delete(woNumber);
    } else {
      newSelected.add(woNumber);
    }
    setSelectedWorkOrders(newSelected);
    setSelectAll(newSelected.size === t1WorkOrders.length);
  };

  const handleLockSchedule = () => {
    if (selectedWorkOrders.size === 0) {
      toast.error("Please select at least one work order to lock");
      return;
    }

    // Get the current week's Monday date for the lock
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const lockWeek = monday.toISOString().split('T')[0];

    // Get selected work order details
    const lockedOrders = t1WorkOrders
      .filter(wo => selectedWorkOrders.has(String(wo["Work Order"])))
      .map(wo => ({
        workOrderNumber: wo["Work Order"],
        description: wo["Description"],
        dataCenter: wo["Data Center"],
        schedStartDate: wo["Sched. Start Date"],
        assignedTo: wo["Assigned To Name"],
        status: wo["Status"],
        type: wo["Type"],
        equipmentDescription: wo["Equipment Description"],
        priority: wo["Priority"],
        shift: wo["Shift"],
        lockWeek: lockWeek
      }));

    // Store in localStorage
    const existingLocks = JSON.parse(localStorage.getItem("scheduleLocks") || "[]");
    const updatedLocks = [...existingLocks, ...lockedOrders];
    localStorage.setItem("scheduleLocks", JSON.stringify(updatedLocks));

    toast.success(`Locked ${selectedWorkOrders.size} work orders for week of ${lockWeek}`);
    setSelectedWorkOrders(new Set());
    setSelectAll(false);
  };

  useEffect(() => {
    setSelectAll(selectedWorkOrders.size === t1WorkOrders.length && t1WorkOrders.length > 0);
  }, [selectedWorkOrders, t1WorkOrders]);

  if (t1WorkOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No T1 work orders available to lock</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              {selectedWorkOrders.size} of {t1WorkOrders.length} work orders selected
            </div>
          </div>
          <Button 
            onClick={handleLockSchedule}
            disabled={selectedWorkOrders.size === 0}
            className="bg-primary hover:bg-primary/90"
          >
            Lock Schedule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-xl font-medium">T1 Work Orders</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select work orders to lock for the schedule
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {t1WorkOrders.map((wo) => {
                  const woNumber = String(wo["Work Order"]);
                  const isReady = wo["Status"]?.toUpperCase() === "READY";
                  const isSelected = selectedWorkOrders.has(woNumber);
                  
                  return (
                    <tr 
                      key={woNumber} 
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      style={{ borderBottomWidth: '0.5px' }}
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleWorkOrder(woNumber)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={`${BASE_URL}${woNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline font-medium"
                          style={{ color: isReady ? '#22c55e' : '#ef4444' }}
                        >
                          {woNumber}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-sm">{wo["Description"]}</td>
                      <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                      <td className="py-3 px-4 text-sm">
                        {formatDate(wo["Sched. Start Date"])}
                      </td>
                      <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                      <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
