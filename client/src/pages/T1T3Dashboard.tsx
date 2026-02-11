/**
 * Swiss Rationalism: T1-T3 Dashboard page (extracted from Home)
 */

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";
import WorkLoadTab from "@/components/WorkLoadTab";
import RiskIdentificationTab from "@/components/RiskIdentificationTab";
import LOTOReviewTab from "@/components/LOTOReviewTab";
import T1NotInReadyTab from "@/components/T1NotInReadyTab";
import T2NotInReadyTab from "@/components/T2NotInReadyTab";
import T3NotInReadyTab from "@/components/T3NotInReadyTab";
import ComplianceCheckTab from "@/components/ComplianceCheckTab";
import { getNextWeekRange, getT2WeekRange, getT3WeekRange } from "@/lib/dateUtils";
import { useState } from "react";

interface T1T3DashboardProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
  pmCodes: PMCode[];
}

export default function T1T3Dashboard({ workOrders, scheduledLabor, pmCodes }: T1T3DashboardProps) {
  const [activeTab, setActiveTab] = useState("t3notready");

  const nextWeekRange = useMemo(() => {
    const { start, end } = getNextWeekRange();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, []);

  const t2WeekRange = useMemo(() => {
    const { start, end } = getT2WeekRange();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, []);

  const t3WeekRange = useMemo(() => {
    const { start, end } = getT3WeekRange();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium text-foreground">T1-T3 Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          T1: {nextWeekRange} | T2: {t2WeekRange} | T3: {t3WeekRange}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 h-auto p-1">
          <TabsTrigger value="t3notready" className="py-3">T3 Not in Ready</TabsTrigger>
          <TabsTrigger value="t2notready" className="py-3">T2 Not in Ready</TabsTrigger>
          <TabsTrigger value="t1notready" className="py-3">T1 Not in Ready</TabsTrigger>
          <TabsTrigger value="workload" className="py-3">T1 Workload</TabsTrigger>
          <TabsTrigger value="risk" className="py-3">Risk Identification</TabsTrigger>
          <TabsTrigger value="loto" className="py-3">LOTO Review</TabsTrigger>
          <TabsTrigger value="compliance" className="py-3">Compliance Check</TabsTrigger>
        </TabsList>

        <TabsContent value="t3notready" className="mt-6">
          <T3NotInReadyTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="t2notready" className="mt-6">
          <T2NotInReadyTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="t1notready" className="mt-6">
          <T1NotInReadyTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="workload" className="mt-6">
          <WorkLoadTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="risk" className="mt-6">
          <RiskIdentificationTab workOrders={workOrders} />
        </TabsContent>

        <TabsContent value="loto" className="mt-6">
          <LOTOReviewTab workOrders={workOrders} scheduledLabor={scheduledLabor} pmCodes={pmCodes} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceCheckTab workOrders={workOrders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
