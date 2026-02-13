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
import { Lock, Unlock, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { getScheduleLocks, lockWorkOrders, unlockWorkOrders, ScheduleLock } from "@/lib/api";

interface ScheduleLockTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduleLockTab({ workOrders }: ScheduleLockTabProps) {
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [lockedWorkOrders, setLockedWorkOrders] = useState<Set<string>>(new Set());
  const [allLocks, setAllLocks] = useState<ScheduleLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(true);
  const [locking, setLocking] = useState(false);

  // Load locked work orders from server
  useEffect(() => {
    async function loadLocks() {
      try {
        const locks = await getScheduleLocks();
        setAllLocks(locks);
        const lockedNumbers = new Set<string>(locks.map(lock => String(lock.workOrderNumber)));
        setLockedWorkOrders(lockedNumbers);
      } catch (error) {
        console.error("Error loading schedule locks:", error);
      } finally {
        setLoadingLocks(false);
      }
    }
    loadLocks();
  }, []);

  const t1WorkOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isWeekly = wo["Description"]?.toUpperCase().includes("WEEKLY");
      return !isCancelled && !isCMCC && !isWeekly && isNextWeek(wo["Sched. Start Date"]);
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

  const handleExportLocked = () => {
    if (allLocks.length === 0) {
      toast.error("No locked work orders to export");
      return;
    }

    // Get next week's Monday date (T1 week)
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    
    // Add 7 days to get next week's Monday
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    
    // Calculate next week's Sunday (end of T1 week)
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    
    // Format dates for filename
    const formatDateForFilename = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const startDate = formatDateForFilename(nextMonday);
    const endDate = formatDateForFilename(nextSunday);
    const filename = `Schedule_Lock_${startDate}_to_${endDate}.xlsx`;

    // Prepare data for export
    const exportData = allLocks.map((order) => ({
      "Work Order": order.workOrderNumber,
      "Description": order.description,
      "Data Center": order.dataCenter,
      "Sched Start Date": order.schedStartDate,
      "Assigned To": order.assignedTo,
      "Status": order.status,
      "Type": order.type,
      "Equipment Description": order.equipmentDescription,
      "Priority": order.priority,
      "Shift": order.shift,
      "Lock Week": order.lockWeek
    }));

    // Create workbook and export
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Locked Schedule");
    XLSX.writeFile(wb, filename);

    toast.success(`Exported ${allLocks.length} locked work orders`);
  };

  const handleUnlockSchedule = async () => {
    if (selectedWorkOrders.size === 0) {
      toast.error("Please select at least one work order to unlock");
      return;
    }

    setLocking(true);
    try {
      await unlockWorkOrders(Array.from(selectedWorkOrders));

      // Update local state
      const newLockedNumbers = new Set(lockedWorkOrders);
      selectedWorkOrders.forEach(wo => newLockedNumbers.delete(wo));
      setLockedWorkOrders(newLockedNumbers);
      setAllLocks(prev => prev.filter(lock => !selectedWorkOrders.has(String(lock.workOrderNumber))));

      toast.success(`Unlocked ${selectedWorkOrders.size} work orders`);
      setSelectedWorkOrders(new Set());
      setSelectAll(false);
    } catch (error: any) {
      toast.error("Failed to unlock: " + error.message);
    } finally {
      setLocking(false);
    }
  };

  const handleLockSchedule = async () => {
    if (selectedWorkOrders.size === 0) {
      toast.error("Please select at least one work order to lock");
      return;
    }

    setLocking(true);
    try {
      // Get the current week's Monday date for the lock
      const today = new Date();
      const currentDay = today.getDay();
      const diff = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      const lockWeek = monday.toISOString().split('T')[0];

      // Get selected work order details
      const lockedOrders: ScheduleLock[] = t1WorkOrders
        .filter(wo => selectedWorkOrders.has(String(wo["Work Order"])))
        .map(wo => ({
          workOrderNumber: String(wo["Work Order"]),
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

      await lockWorkOrders(lockedOrders);

      // Update local state
      const newLockedNumbers = new Set(lockedWorkOrders);
      selectedWorkOrders.forEach(wo => newLockedNumbers.add(wo));
      setLockedWorkOrders(newLockedNumbers);
      setAllLocks(prev => [...prev, ...lockedOrders]);

      toast.success(`Locked ${selectedWorkOrders.size} work orders for week of ${lockWeek}`);
      setSelectedWorkOrders(new Set());
      setSelectAll(false);
    } catch (error: any) {
      toast.error("Failed to lock: " + error.message);
    } finally {
      setLocking(false);
    }
  };

  useEffect(() => {
    setSelectAll(selectedWorkOrders.size === t1WorkOrders.length && t1WorkOrders.length > 0);
  }, [selectedWorkOrders, t1WorkOrders]);

  if (loadingLocks) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schedule locks...</p>
        </CardContent>
      </Card>
    );
  }

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
          <div className="flex gap-2">
            <Button 
              onClick={handleExportLocked}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Locked
            </Button>
            <Button 
              onClick={handleLockSchedule}
              disabled={selectedWorkOrders.size === 0 || locking}
              className="bg-primary hover:bg-primary/90"
            >
              {locking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lock Schedule
            </Button>
            <Button 
              onClick={handleUnlockSchedule}
              disabled={selectedWorkOrders.size === 0 || locking}
              variant="destructive"
            >
              Unlock Selected
            </Button>
          </div>
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
                          checked={selectedWorkOrders.has(woNumber)}
                          onCheckedChange={() => handleToggleWorkOrder(woNumber)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {lockedWorkOrders.has(woNumber) ? (
                          <Lock className="h-4 w-4 text-green-600" />
                        ) : (
                          <Unlock className="h-4 w-4 text-red-600" />
                        )}
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
