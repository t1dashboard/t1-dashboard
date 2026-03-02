/**
 * Swiss Rationalism: Deconfliction tab — identifies work orders on the same day,
 * in the same data center, that reference matching critical equipment identifiers
 * (MSB, EG, UPS, PTX with their associated numbers/letters).
 *
 * Example: "3EG-N3" and "3MSB-N3" both reference the N3 infrastructure chain
 * and would be flagged if scheduled on the same day in the same data center.
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseExcelDate, formatDate, isTWeek } from "@/lib/dateUtils";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface DeconflictionTabProps {
  workOrders: WorkOrder[];
}

/** Equipment types we track for deconfliction */
const EQUIPMENT_PATTERNS = ["MSB", "EG", "UPS", "PTX"];

/**
 * Extract equipment identifiers from a text string.
 * Looks for patterns like: 3EG-N3, MSB-N3, 2UPS-A1, PTX-B2, etc.
 * Returns an array of normalized identifiers, e.g. ["EG-N3", "MSB-N3"]
 * We strip the leading number prefix to get the core equipment type + identifier.
 */
function extractEquipmentIds(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];

  // Pattern: optional leading digits, then equipment type, then a separator (dash, space, or nothing),
  // then an identifier (alphanumeric). Examples: 3EG-N3, MSB-N3, 2UPS-A1, PTX B2, EG3
  for (const eqType of EQUIPMENT_PATTERNS) {
    // Match patterns like: 3EG-N3, EG-N3, 3EG N3, EGN3, etc.
    // Also match: EG-3, MSB-1A, UPS-2B, etc.
    const regex = new RegExp(
      `\\d*${eqType}[\\s\\-]?([A-Za-z0-9]+[A-Za-z0-9\\-]*)`,
      "gi"
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Normalize: extract the identifier part after the equipment type
      const fullMatch = match[0];
      // Get the part after the equipment type name
      const afterType = fullMatch.replace(/^\d*/, "").replace(new RegExp(`^${eqType}[\\s\\-]?`, "i"), "");
      if (afterType) {
        // Normalize to uppercase: "EG-N3" format
        ids.push(`${eqType}-${afterType.toUpperCase()}`);
      }
    }
  }

  return ids;
}

/**
 * Get a date key string (YYYY-MM-DD) from a work order's sched start date
 */
function getDateKey(date: any): string | null {
  const parsed = parseExcelDate(date);
  if (!parsed) return null;
  return parsed.toISOString().split("T")[0];
}

interface ConflictGroup {
  dateKey: string;
  dateFormatted: string;
  dataCenter: string;
  equipmentId: string;
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function DeconflictionTab({ workOrders }: DeconflictionTabProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filter to T1-T3 work orders and find conflicts
  const { conflictsByDC, totalConflicts } = useMemo(() => {
    // Filter to T1-T3 work orders only, exclude closed/cancelled/work complete
    const t1t3WOs = workOrders.filter(wo => {
      const isT1T3 = isTWeek(wo["Sched. Start Date"], 1) || 
                     isTWeek(wo["Sched. Start Date"], 2) || 
                     isTWeek(wo["Sched. Start Date"], 3);
      const status = (wo["Status"] || "").toLowerCase();
      const excluded = ["closed", "cancelled", "work complete"].includes(status);
      return isT1T3 && !excluded;
    });

    // Build a map: dataCenter -> dateKey -> equipmentId -> WorkOrder[]
    const dcDateEquipMap = new Map<string, Map<string, Map<string, WorkOrder[]>>>();

    for (const wo of t1t3WOs) {
      const dc = wo["Data Center"] || "Unknown";
      const dateKey = getDateKey(wo["Sched. Start Date"]);
      if (!dateKey) continue;

      // Extract equipment IDs from both Description and Equipment Description
      const descIds = extractEquipmentIds(wo["Description"] || "");
      const equipDescIds = extractEquipmentIds(wo["Equipment Description"] || "");
      const allIds = Array.from(new Set([...descIds, ...equipDescIds]));

      if (allIds.length === 0) continue;

      if (!dcDateEquipMap.has(dc)) dcDateEquipMap.set(dc, new Map());
      const dateMap = dcDateEquipMap.get(dc)!;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
      const equipMap = dateMap.get(dateKey)!;

      for (const eqId of allIds) {
        if (!equipMap.has(eqId)) equipMap.set(eqId, []);
        const list = equipMap.get(eqId)!;
        // Avoid duplicates
        if (!list.some(w => w["Work Order"] === wo["Work Order"])) {
          list.push(wo);
        }
      }
    }

    // Collect conflict groups (where 2+ WOs share the same equipment on the same day in the same DC)
    const conflicts: ConflictGroup[] = [];
    Array.from(dcDateEquipMap.entries()).forEach(([dc, dateMap]) => {
      Array.from(dateMap.entries()).forEach(([dateKey, equipMap]) => {
        Array.from(equipMap.entries()).forEach(([eqId, wos]) => {
          if (wos.length >= 2) {
            const parsed = new Date(dateKey);
            const dateFormatted = parsed.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            conflicts.push({ dateKey, dateFormatted, dataCenter: dc, equipmentId: eqId, workOrders: wos });
          }
        });
      });
    });

    // Group by data center, sort DCs alphabetically
    const byDC = new Map<string, ConflictGroup[]>();
    for (const group of conflicts) {
      if (!byDC.has(group.dataCenter)) byDC.set(group.dataCenter, []);
      byDC.get(group.dataCenter)!.push(group);
    }

    // Sort each DC's conflicts by date then equipment
    Array.from(byDC.entries()).forEach(([, groups]) => {
      groups.sort((a: ConflictGroup, b: ConflictGroup) => a.dateKey.localeCompare(b.dateKey) || a.equipmentId.localeCompare(b.equipmentId));
    });

    const sortedDCs = new Map<string, ConflictGroup[]>(Array.from(byDC.entries()).sort((a, b) => a[0].localeCompare(b[0])));

    return {
      conflictsByDC: sortedDCs,
      totalConflicts: conflicts.length,
    };
  }, [workOrders]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const allKeys = new Set<string>();
    Array.from(conflictsByDC.entries()).forEach(([dc, groups]: [string, ConflictGroup[]]) => {
      allKeys.add(`dc-${dc}`);
      groups.forEach((g: ConflictGroup) => {
        allKeys.add(`${dc}-${g.dateKey}-${g.equipmentId}`);
      });
    });
    setExpandedGroups(allKeys);
  };

  const collapseAll = () => setExpandedGroups(new Set());

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Deconfliction — T1-T3
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Work orders on the same day, same data center, referencing the same critical equipment (MSB, EG, UPS, PTX)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-semibold text-foreground">{totalConflicts}</div>
                <div className="text-xs text-muted-foreground">conflict{totalConflicts !== 1 ? "s" : ""} found</div>
              </div>
              <div className="flex gap-1">
                <button onClick={expandAll} className="text-xs text-primary hover:underline px-2 py-1">
                  Expand All
                </button>
                <button onClick={collapseAll} className="text-xs text-muted-foreground hover:underline px-2 py-1">
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {totalConflicts === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No equipment conflicts found in T1-T3 work orders.</p>
              <p className="text-xs mt-1">Checked for overlapping MSB, EG, UPS, and PTX references on the same day and data center.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(conflictsByDC.entries()).map(([dc, groups]: [string, ConflictGroup[]]) => {
                const dcKey = `dc-${dc}`;
                const dcExpanded = expandedGroups.has(dcKey);
                const totalWOs = groups.reduce((sum: number, g: ConflictGroup) => sum + g.workOrders.length, 0);

                return (
                  <div key={dc} className="border border-border rounded-lg overflow-hidden">
                    {/* Data Center Header */}
                    <button
                      onClick={() => toggleGroup(dcKey)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {dcExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-semibold text-foreground">{dc}</span>
                        <span className="text-xs text-muted-foreground">
                          — {groups.length} conflict{groups.length !== 1 ? "s" : ""}, {totalWOs} work orders
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-600">{groups.length}</span>
                      </div>
                    </button>

                    {/* Conflict Groups */}
                    {dcExpanded && (
                      <div className="divide-y divide-border">
                        {groups.map((group: ConflictGroup) => {
                          const groupKey = `${dc}-${group.dateKey}-${group.equipmentId}`;
                          const groupExpanded = expandedGroups.has(groupKey);

                          return (
                            <div key={groupKey}>
                              <button
                                onClick={() => toggleGroup(groupKey)}
                                className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {groupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  <span className="text-sm font-medium text-foreground">{group.dateFormatted}</span>
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">
                                    {group.equipmentId}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {group.workOrders.length} WOs
                                </span>
                              </button>

                              {groupExpanded && (
                                <div className="px-6 pb-3">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th className="py-2 pr-3 w-28">Work Order</th>
                                        <th className="py-2 pr-3">Description</th>
                                        <th className="py-2 pr-3 w-40">Equipment Desc.</th>
                                        <th className="py-2 pr-3 w-20">Shift</th>
                                        <th className="py-2 pr-3 w-24">Status</th>
                                        <th className="py-2 w-20">Priority</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.workOrders
                                        .sort((a: WorkOrder, b: WorkOrder) => String(a["Work Order"]).localeCompare(String(b["Work Order"])))
                                        .map((wo: WorkOrder) => (
                                          <tr key={wo["Work Order"]} className="border-b border-border/50 last:border-0">
                                            <td className="py-2 pr-3">
                                              <a
                                                href={`${BASE_URL}${wo["Work Order"]}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline font-mono text-xs"
                                              >
                                                {wo["Work Order"]}
                                              </a>
                                            </td>
                                            <td className="py-2 pr-3 text-xs">{wo["Description"]}</td>
                                            <td className="py-2 pr-3 text-xs text-muted-foreground">{wo["Equipment Description"]}</td>
                                            <td className="py-2 pr-3 text-xs">{wo["Shift"]}</td>
                                            <td className="py-2 pr-3">
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                (wo["Status"] || "").toLowerCase() === "ready"
                                                  ? "bg-green-100 text-green-800"
                                                  : (wo["Status"] || "").toLowerCase() === "in process"
                                                  ? "bg-blue-100 text-blue-800"
                                                  : "bg-amber-100 text-amber-800"
                                              }`}>
                                                {wo["Status"]}
                                              </span>
                                            </td>
                                            <td className="py-2 text-xs">{wo["Priority"]}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipment Pattern Legend */}
      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-primary">i</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Equipment Matching</p>
              <p>
                Scans Description and Equipment Description for critical infrastructure identifiers:
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">MSB</span>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">EG</span>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">UPS</span>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">PTX</span>
                followed by their identifier (e.g., 3EG-N3 and 3MSB-N3 both reference N3 infrastructure).
                Conflicts are flagged when 2+ work orders touch the same equipment chain on the same day in the same data center.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
