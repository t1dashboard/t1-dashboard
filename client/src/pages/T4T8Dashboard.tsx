/**
 * Swiss Rationalism: T4-T8 Dashboard page
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrder } from "@/types/workOrder";
import { CommentData, getUploadMetadata } from "@/lib/api";
import T1NotInReadyTab from "@/components/T1NotInReadyTab";
import T4T8NotInApprovedTab from "@/components/T4T8NotInApprovedTab";
import WOsOver30DaysTab from "@/components/WOsOver30DaysTab";
import DeferralDashboard from "@/pages/DeferralDashboard";
import ComplianceCheckTab from "@/components/ComplianceCheckTab";
import DeconflictionTab from "@/components/DeconflictionTab";
import { useState, useEffect, useMemo } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { triggerSync, getSyncStatus as fetchSyncStatus } from "@/lib/api";
import { toast } from "sonner";

interface T4T8DashboardProps {
  workOrders: WorkOrder[];
  commentsMap?: Record<string, CommentData>;
}

export default function T4T8Dashboard({ workOrders, commentsMap = {} }: T4T8DashboardProps) {
  const [activeTab, setActiveTab] = useState("t1notready");
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);
  const [lastWebhookSync, setLastWebhookSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const metadata = await getUploadMetadata();
        setLastUploaded(metadata.workOrders);
        setLastWebhookSync(metadata.webhookSync?.work_orders || null);
      } catch (e) {
        console.error("Error loading upload metadata:", e);
      }
    }
    loadMetadata();
  }, []);

  const lastDataUpdate = useMemo(() => {
    const dates: Date[] = [];
    if (lastUploaded) dates.push(new Date(lastUploaded));
    if (lastWebhookSync) dates.push(new Date(lastWebhookSync));
    if (dates.length === 0) return null;
    return dates.reduce((a, b) => a > b ? a : b);
  }, [lastUploaded, lastWebhookSync]);

  const syncSource = useMemo(() => {
    if (!lastUploaded && !lastWebhookSync) return null;
    if (!lastWebhookSync) return 'upload';
    if (!lastUploaded) return 'auto-sync';
    return new Date(lastWebhookSync) >= new Date(lastUploaded) ? 'auto-sync' : 'upload';
  }, [lastUploaded, lastWebhookSync]);

  const isStale = useMemo(() => {
    if (!lastDataUpdate) return false;
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - lastDataUpdate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  }, [lastDataUpdate]);

  const formattedUploadDate = useMemo(() => {
    if (!lastDataUpdate) return null;
    return lastDataUpdate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [lastDataUpdate]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-foreground">T4-T8 Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Extended planning and aging work order tracking
          </p>
        </div>
        <button
          onClick={async () => {
            if (isSyncing) return;
            setIsSyncing(true);
            try {
              await triggerSync();
              toast.info("Sync started — refreshing data...");
              const poll = setInterval(async () => {
                try {
                  const status = await fetchSyncStatus();
                  if (!status.isSyncing) {
                    clearInterval(poll);
                    setIsSyncing(false);
                    if (status.lastSyncResult?.success) {
                      toast.success(`Sync complete — ${status.lastSyncResult.results.map(r => `${r.rowCount} ${r.tableName}`).join(", ")}`);
                    } else {
                      toast.error("Sync completed with errors");
                    }
                    window.location.reload();
                  }
                } catch (e) { /* keep polling */ }
              }, 3000);
            } catch (e: any) {
              setIsSyncing(false);
              toast.error(e.message || "Failed to trigger sync");
            }
          }}
          disabled={isSyncing}
          className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 ${
            isStale
              ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
              : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          } ${isSyncing ? 'opacity-60' : ''}`}
          title="Click to sync from Google Sheets"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : isStale ? 'Stale data — ' : syncSource === 'auto-sync' ? 'Auto-synced ' : 'Uploaded '}
          {!isSyncing && formattedUploadDate}
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1">
          <TabsTrigger value="t1notready" className="py-3">T1 Not in Ready</TabsTrigger>
          <TabsTrigger value="t4t8notapproved" className="py-3">T4-T8 Not in Approved</TabsTrigger>
          <TabsTrigger value="over30days" className="py-3">WOs &gt;30 Days</TabsTrigger>
          <TabsTrigger value="over90days" className="py-3">&gt;90 Days with Deferral</TabsTrigger>
          <TabsTrigger value="compliance" className="py-3">Compliance Check</TabsTrigger>
          <TabsTrigger value="deconfliction" className="py-3">Deconfliction</TabsTrigger>
        </TabsList>

        <TabsContent value="t1notready" className="mt-6">
          <T1NotInReadyTab workOrders={workOrders} commentsMap={commentsMap} />
        </TabsContent>

        <TabsContent value="t4t8notapproved" className="mt-6">
          <T4T8NotInApprovedTab workOrders={workOrders} commentsMap={commentsMap} />
        </TabsContent>

        <TabsContent value="over30days" className="mt-6">
          <WOsOver30DaysTab workOrders={workOrders} commentsMap={commentsMap} />
        </TabsContent>

        <TabsContent value="over90days" className="mt-6">
          <DeferralDashboard workOrders={workOrders} commentsMap={commentsMap} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceCheckTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="deconfliction" className="mt-6">
          <DeconflictionTab workOrders={workOrders} tWeekRange={[4, 8]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
