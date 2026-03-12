/**
 * Swiss Rationalism: T4-T8 Dashboard page
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrder } from "@/types/workOrder";
import T1NotInReadyTab from "@/components/T1NotInReadyTab";
import T4T8NotInApprovedTab from "@/components/T4T8NotInApprovedTab";
import WOsOver30DaysTab from "@/components/WOsOver30DaysTab";
import DeferralDashboard from "@/pages/DeferralDashboard";
import ComplianceCheckTab from "@/components/ComplianceCheckTab";
import DeconflictionTab from "@/components/DeconflictionTab";
import { useState } from "react";

interface T4T8DashboardProps {
  workOrders: WorkOrder[];
}

export default function T4T8Dashboard({ workOrders }: T4T8DashboardProps) {
  const [activeTab, setActiveTab] = useState("t1notready");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium text-foreground">T4-T8 Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Extended planning and aging work order tracking
        </p>
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
          <T1NotInReadyTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="t4t8notapproved" className="mt-6">
          <T4T8NotInApprovedTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="over30days" className="mt-6">
          <WOsOver30DaysTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="over90days" className="mt-6">
          <DeferralDashboard workOrders={workOrders} />
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
