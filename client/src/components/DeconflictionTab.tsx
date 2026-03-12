/**
 * Swiss Rationalism: Deconfliction tab — identifies work orders whose work windows
 * overlap (sched start through sched end) in the same data center, where both
 * reference related critical equipment (MSB, EG, UPS, PTX).
 *
 * Also detects transformer-based conflicts: when a transformer (T-A through T-E)
 * work order overlaps with equipment work (MSB, EG, UPS, PTX) in either of the
 * two buildings the transformer powers.
 *
 * Example: WO with "3EG-N3" spanning Mon-Fri and WO with "3UPS-N3" starting Tue
 * would be flagged because they share the N3 infrastructure chain and overlap.
 *
 * Transformer example: WO with "T-A" in NCG1 and WO with "1EG-01" in NCG6 would
 * be flagged because T-A powers NCG1 and NCG6.
 *
 * Each unique set of conflicting WOs appears only once per data center (no duplicates).
 */

import { useMemo, useState } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseExcelDate, formatDate, isTWeek } from "@/lib/dateUtils";
import { AlertTriangle, ChevronDown, ChevronRight, Zap } from "lucide-react";

interface DeconflictionTabProps {
  workOrders: WorkOrder[];
  /** T-week range to filter. Defaults to [1,3] for T1-T3 */
  tWeekRange?: [number, number];
  /** Label for the header. Defaults to "T1-T3" */
  label?: string;
}

/** Equipment types we track for deconfliction */
const EQUIPMENT_PATTERNS = ["MSB", "EG", "UPS", "PTX"];

/**
 * Transformer-to-building mapping.
 * Each transformer letter maps to the two buildings it powers, keyed by campus prefix.
 */
const TRANSFORMER_MAP: Record<string, Record<string, [string, string]>> = {
  NCG: {
    A: ["NCG1", "NCG6"],
    B: ["NCG1", "NCG2"],
    C: ["NCG2", "NCG3"],
    D: ["NCG5", "NCG6"],
    E: ["NCG5", "NCG6"],
  },
  MWG: {
    A: ["MWG1", "MWG3"],
    B: ["MWG1", "MWG2"],
    C: ["MWG2", "MWG3"],
  },
};

/**
 * Extract the infrastructure chain identifier from text.
 * For "3EG-N3" → chain is "N3", equipment type is "EG"
 * For "3MSB-N3" → chain is "N3", equipment type is "MSB"
 * Returns array of { type, chain } objects.
 */
function extractEquipmentInfo(text: string): Array<{ type: string; chain: string; fullId: string }> {
  if (!text) return [];
  const results: Array<{ type: string; chain: string; fullId: string }> = [];

  for (const eqType of EQUIPMENT_PATTERNS) {
    const regex = new RegExp(
      `\\d*${eqType}[\\s\\-]?([A-Za-z0-9]+[A-Za-z0-9\\-]*)`,
      "gi"
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const afterType = fullMatch.replace(/^\d*/, "").replace(new RegExp(`^${eqType}[\\s\\-]?`, "i"), "");
      if (afterType) {
        const chain = afterType.toUpperCase();
        results.push({
          type: eqType,
          chain,
          fullId: `${eqType}-${chain}`,
        });
      }
    }
  }

  return results;
}

/**
 * Extract transformer info from text.
 * Looks for patterns like "T-A", "T-B", "T-C", "T-D", "T-E" in the description.
 * Returns the transformer letter (A, B, C, D, E) or null.
 */
function extractTransformerLetter(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\bT-([A-E])\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get the campus prefix from a data center name.
 * "NCG1" → "NCG", "MWG2" → "MWG"
 */
function getCampusPrefix(dataCenter: string): string | null {
  const match = dataCenter.match(/^([A-Z]+)\d/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get the paired buildings for a transformer letter in a given campus.
 */
function getTransformerBuildings(campus: string, letter: string): [string, string] | null {
  const campusMap = TRANSFORMER_MAP[campus];
  if (!campusMap) return null;
  return campusMap[letter] || null;
}

/**
 * Get the date range (start, end) for a work order.
 * Uses sched start and sched end dates. If end date is missing, assumes same day.
 */
function getWorkWindow(wo: WorkOrder): { start: Date; end: Date } | null {
  const startParsed = parseExcelDate(wo["Sched. Start Date"]);
  if (!startParsed) return null;

  const endParsed = parseExcelDate(wo["Sched. End Date"]);
  const start = new Date(startParsed);
  start.setHours(0, 0, 0, 0);

  const end = endParsed ? new Date(endParsed) : new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Check if two date ranges overlap.
 */
function dateRangesOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

interface ConflictGroup {
  dataCenter: string;
  chain: string; // The shared infrastructure chain (e.g., "N3")
  equipmentTypes: string[]; // The equipment types involved (e.g., ["EG", "UPS"])
  workOrders: WorkOrder[];
  overlapStart: string; // Earliest start date formatted
  overlapEnd: string; // Latest end date formatted
  sortKey: string; // For sorting
  isTransformerConflict?: boolean; // Whether this is a transformer cross-building conflict
  transformerLabel?: string; // e.g., "T-A (NCG1 / NCG6)"
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function DeconflictionTab({ workOrders, tWeekRange = [1, 3], label }: DeconflictionTabProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const rangeLabel = label || `T${tWeekRange[0]}-T${tWeekRange[1]}`;

  const { conflictsByDC, transformerConflicts, totalConflicts, totalTransformerConflicts } = useMemo(() => {
    // Filter to specified T-week range, exclude closed/cancelled/work complete
    const filteredWOs = workOrders.filter((wo: WorkOrder) => {
      let inRange = false;
      for (let t = tWeekRange[0]; t <= tWeekRange[1]; t++) {
        if (isTWeek(wo["Sched. Start Date"], t)) {
          inRange = true;
          break;
        }
      }
      const status = (wo["Status"] || "").toLowerCase();
      const excluded = ["closed", "cancelled", "work complete"].includes(status);
      return inRange && !excluded;
    });

    // For each WO, extract equipment info and work window
    interface WOWithEquip {
      wo: WorkOrder;
      window: { start: Date; end: Date };
      equipInfo: Array<{ type: string; chain: string; fullId: string }>;
      transformerLetter: string | null;
    }

    const enriched: WOWithEquip[] = [];
    for (const wo of filteredWOs) {
      const window = getWorkWindow(wo);
      if (!window) continue;

      const descInfo = extractEquipmentInfo(wo["Description"] || "");
      const equipDescInfo = extractEquipmentInfo(wo["Equipment Description"] || "");
      // Deduplicate by fullId
      const seen = new Set<string>();
      const allInfo: Array<{ type: string; chain: string; fullId: string }> = [];
      for (const info of [...descInfo, ...equipDescInfo]) {
        if (!seen.has(info.fullId)) {
          seen.add(info.fullId);
          allInfo.push(info);
        }
      }

      const transformerLetter = extractTransformerLetter(wo["Description"] || "") ||
                                 extractTransformerLetter(wo["Equipment Description"] || "");

      if (allInfo.length > 0 || transformerLetter) {
        enriched.push({ wo, window, equipInfo: allInfo, transformerLetter });
      }
    }

    // ===== SAME-BUILDING CHAIN CONFLICTS (existing logic) =====
    // Group by data center
    const byDC = new Map<string, WOWithEquip[]>();
    for (const item of enriched) {
      const dc = item.wo["Data Center"] || "Unknown";
      if (!byDC.has(dc)) byDC.set(dc, []);
      byDC.get(dc)!.push(item);
    }

    // For each DC, find conflicts: WOs that share the same chain AND have overlapping windows
    const allConflicts: ConflictGroup[] = [];

    Array.from(byDC.entries()).forEach(([dc, items]) => {
      // Group items by chain
      const byChain = new Map<string, WOWithEquip[]>();
      for (const item of items) {
        for (const eq of item.equipInfo) {
          if (!byChain.has(eq.chain)) byChain.set(eq.chain, []);
          const list = byChain.get(eq.chain)!;
          if (!list.some((existing: WOWithEquip) => existing.wo["Work Order"] === item.wo["Work Order"])) {
            list.push(item);
          }
        }
      }

      // For each chain, find overlapping WOs
      const processedPairs = new Set<string>();

      Array.from(byChain.entries()).forEach(([chain, chainItems]) => {
        if (chainItems.length < 2) return;

        // Find all WOs in this chain that overlap with at least one other
        const conflictingWOs: WOWithEquip[] = [];
        for (let i = 0; i < chainItems.length; i++) {
          let hasOverlap = false;
          for (let j = 0; j < chainItems.length; j++) {
            if (i === j) continue;
            if (dateRangesOverlap(chainItems[i].window, chainItems[j].window)) {
              hasOverlap = true;
              break;
            }
          }
          if (hasOverlap) {
            conflictingWOs.push(chainItems[i]);
          }
        }

        if (conflictingWOs.length < 2) return;

        // Create a unique key for this set of WOs to prevent duplicates
        const woIds = conflictingWOs
          .map((item: WOWithEquip) => item.wo["Work Order"])
          .sort((a: number, b: number) => a - b);
        const pairKey = `${dc}-${woIds.join("-")}`;

        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);

        // Collect all equipment types involved
        const eqTypesSet = new Set<string>();
        for (const item of conflictingWOs) {
          for (const eq of item.equipInfo) {
            if (eq.chain === chain) {
              eqTypesSet.add(eq.type);
            }
          }
        }

        // Find the overall date span
        let earliest = conflictingWOs[0].window.start;
        let latest = conflictingWOs[0].window.end;
        for (const item of conflictingWOs) {
          if (item.window.start < earliest) earliest = item.window.start;
          if (item.window.end > latest) latest = item.window.end;
        }

        const overlapStart = earliest.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const overlapEnd = latest.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        allConflicts.push({
          dataCenter: dc,
          chain,
          equipmentTypes: Array.from(eqTypesSet).sort(),
          workOrders: conflictingWOs.map((item: WOWithEquip) => item.wo),
          overlapStart,
          overlapEnd,
          sortKey: earliest.toISOString().split("T")[0] + chain,
        });
      });
    });

    // Group same-building conflicts by DC and sort
    const conflictsByDCMap = new Map<string, ConflictGroup[]>();
    for (const group of allConflicts) {
      if (!conflictsByDCMap.has(group.dataCenter)) conflictsByDCMap.set(group.dataCenter, []);
      conflictsByDCMap.get(group.dataCenter)!.push(group);
    }

    Array.from(conflictsByDCMap.entries()).forEach(([, groups]) => {
      groups.sort((a: ConflictGroup, b: ConflictGroup) => a.sortKey.localeCompare(b.sortKey));
    });

    const sortedDC = new Map<string, ConflictGroup[]>(
      Array.from(conflictsByDCMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    );

    // ===== TRANSFORMER CROSS-BUILDING CONFLICTS =====
    const xformerConflicts: ConflictGroup[] = [];
    const processedXformerPairs = new Set<string>();

    // Find all transformer WOs
    const transformerWOs = enriched.filter(item => item.transformerLetter !== null);

    // Find all equipment WOs (those with MSB, EG, UPS, PTX)
    const equipmentWOs = enriched.filter(item => item.equipInfo.length > 0);

    for (const xformerItem of transformerWOs) {
      const xformerDC = (xformerItem.wo["Data Center"] || "").toUpperCase();
      const campus = getCampusPrefix(xformerDC);
      if (!campus) continue;

      const letter = xformerItem.transformerLetter!;
      const pairedBuildings = getTransformerBuildings(campus, letter);
      if (!pairedBuildings) continue;

      // Find equipment WOs in either of the paired buildings that overlap with this transformer WO
      for (const equipItem of equipmentWOs) {
        // Don't compare a WO with itself
        if (equipItem.wo["Work Order"] === xformerItem.wo["Work Order"]) continue;

        const equipDC = (equipItem.wo["Data Center"] || "").toUpperCase();

        // Ensure the equipment WO is in the same campus (NCG with NCG, MWG with MWG)
        const equipCampus = getCampusPrefix(equipDC);
        if (equipCampus !== campus) continue;

        // Check if the equipment WO is in one of the paired buildings
        if (!pairedBuildings.includes(equipDC)) continue;

        // Check for date overlap
        if (!dateRangesOverlap(xformerItem.window, equipItem.window)) continue;

        // Create a unique key to prevent duplicates
        const woIds = [xformerItem.wo["Work Order"], equipItem.wo["Work Order"]]
          .sort((a: number, b: number) => a - b);
        const pairKey = `xformer-${woIds.join("-")}`;

        if (processedXformerPairs.has(pairKey)) continue;
        processedXformerPairs.add(pairKey);

        // Collect equipment types from the equipment WO
        const eqTypesSet = new Set(equipItem.equipInfo.map(eq => eq.type));
        const eqTypes = Array.from(eqTypesSet).sort();

        // Find the overall date span
        const earliest = xformerItem.window.start < equipItem.window.start
          ? xformerItem.window.start : equipItem.window.start;
        const latest = xformerItem.window.end > equipItem.window.end
          ? xformerItem.window.end : equipItem.window.end;

        const overlapStart = earliest.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const overlapEnd = latest.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        const transformerLabel = `T-${letter} (${pairedBuildings[0]} / ${pairedBuildings[1]})`;

        xformerConflicts.push({
          dataCenter: `${pairedBuildings[0]} / ${pairedBuildings[1]}`,
          chain: `T-${letter}`,
          equipmentTypes: eqTypes,
          workOrders: [xformerItem.wo, equipItem.wo],
          overlapStart,
          overlapEnd,
          sortKey: earliest.toISOString().split("T")[0] + `T-${letter}`,
          isTransformerConflict: true,
          transformerLabel,
        });
      }
    }

    // Sort transformer conflicts
    xformerConflicts.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return {
      conflictsByDC: sortedDC,
      transformerConflicts: xformerConflicts,
      totalConflicts: allConflicts.length,
      totalTransformerConflicts: xformerConflicts.length,
    };
  }, [workOrders, tWeekRange]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev: Set<string>) => {
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
      groups.forEach((_g: ConflictGroup, i: number) => {
        allKeys.add(`${dc}-${i}`);
      });
    });
    allKeys.add("xformer-section");
    transformerConflicts.forEach((_g: ConflictGroup, i: number) => {
      allKeys.add(`xformer-${i}`);
    });
    setExpandedGroups(allKeys);
  };

  const collapseAll = () => setExpandedGroups(new Set());

  const grandTotal = totalConflicts + totalTransformerConflicts;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Deconfliction — {rangeLabel}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Work orders with overlapping work windows referencing related critical equipment (MSB, EG, UPS, PTX) — includes transformer cross-building conflicts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-semibold text-foreground">{grandTotal}</div>
                <div className="text-xs text-muted-foreground">conflict{grandTotal !== 1 ? "s" : ""} found</div>
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
          {grandTotal === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No equipment conflicts found in {rangeLabel} work orders.</p>
              <p className="text-xs mt-1">Checked for overlapping MSB, EG, UPS, and PTX work windows within the same data center and across transformer-paired buildings.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Same-building chain conflicts */}
              {totalConflicts > 0 && (
                <>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    Same-Building Chain Conflicts ({totalConflicts})
                  </div>
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
                            {groups.map((group: ConflictGroup, idx: number) => {
                              const groupKey = `${dc}-${idx}`;
                              const groupExpanded = expandedGroups.has(groupKey);
                              const dateRange = group.overlapStart === group.overlapEnd
                                ? group.overlapStart
                                : `${group.overlapStart} — ${group.overlapEnd}`;

                              return (
                                <div key={groupKey}>
                                  <button
                                    onClick={() => toggleGroup(groupKey)}
                                    className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-muted/30 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      {groupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      <span className="text-sm font-medium text-foreground">{dateRange}</span>
                                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">
                                        {group.equipmentTypes.join(" / ")}-{group.chain}
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
                                            <th className="py-2 pr-3 w-24">Data Center</th>
                                            <th className="py-2 pr-3 w-24">Start Date</th>
                                            <th className="py-2 pr-3 w-24">End Date</th>
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
                                                <td className="py-2 pr-3 text-xs">{wo["Data Center"]}</td>
                                                <td className="py-2 pr-3 text-xs">{formatDate(wo["Sched. Start Date"])}</td>
                                                <td className="py-2 pr-3 text-xs">{formatDate(wo["Sched. End Date"])}</td>
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
                </>
              )}

              {/* Transformer Cross-Building Conflicts */}
              {totalTransformerConflicts > 0 && (
                <>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mt-6 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Transformer Cross-Building Conflicts ({totalTransformerConflicts})
                  </div>
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleGroup("xformer-section")}
                      className="w-full flex items-center justify-between px-4 py-3 bg-amber-50/50 hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedGroups.has("xformer-section") ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Zap className="h-4 w-4 text-amber-600" />
                        <span className="font-semibold text-foreground">Transformer Conflicts</span>
                        <span className="text-xs text-muted-foreground">
                          — {totalTransformerConflicts} conflict{totalTransformerConflicts !== 1 ? "s" : ""} across paired buildings
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-600">{totalTransformerConflicts}</span>
                      </div>
                    </button>

                    {expandedGroups.has("xformer-section") && (
                      <div className="divide-y divide-border">
                        {transformerConflicts.map((group: ConflictGroup, idx: number) => {
                          const groupKey = `xformer-${idx}`;
                          const groupExpanded = expandedGroups.has(groupKey);
                          const dateRange = group.overlapStart === group.overlapEnd
                            ? group.overlapStart
                            : `${group.overlapStart} — ${group.overlapEnd}`;

                          return (
                            <div key={groupKey}>
                              <button
                                onClick={() => toggleGroup(groupKey)}
                                className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-amber-50/30 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {groupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  <span className="text-sm font-medium text-foreground">{dateRange}</span>
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">
                                    {group.transformerLabel}
                                  </span>
                                  {group.equipmentTypes.length > 0 && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono">
                                      {group.equipmentTypes.join(" / ")}
                                    </span>
                                  )}
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
                                        <th className="py-2 pr-3 w-24">Data Center</th>
                                        <th className="py-2 pr-3 w-24">Start Date</th>
                                        <th className="py-2 pr-3 w-24">End Date</th>
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
                                            <td className="py-2 pr-3 text-xs font-medium">{wo["Data Center"]}</td>
                                            <td className="py-2 pr-3 text-xs">{formatDate(wo["Sched. Start Date"])}</td>
                                            <td className="py-2 pr-3 text-xs">{formatDate(wo["Sched. End Date"])}</td>
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
                </>
              )}
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
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground mb-1">Equipment Matching</p>
              <p>
                Scans Description and Equipment Description for critical infrastructure identifiers:
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">MSB</span>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">EG</span>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">UPS</span>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">PTX</span>
                followed by their chain identifier (e.g., 3EG-N3 and 3MSB-N3 both reference the N3 chain).
                Conflicts are flagged when 2+ work orders on the same infrastructure chain have overlapping work windows (start date through end date) in the same data center.
              </p>
              <p className="font-medium text-foreground mt-2 mb-1 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Transformer Matching
              </p>
              <p>
                Detects transformer references
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">T-A</span>
                through
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">T-E</span>
                in work order descriptions. Each transformer powers two buildings:
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1 ml-2 text-xs">
                <div><span className="font-mono font-medium">NCG T-A:</span> NCG1 / NCG6</div>
                <div><span className="font-mono font-medium">MWG T-A:</span> MWG1 / MWG3</div>
                <div><span className="font-mono font-medium">NCG T-B:</span> NCG1 / NCG2</div>
                <div><span className="font-mono font-medium">MWG T-B:</span> MWG1 / MWG2</div>
                <div><span className="font-mono font-medium">NCG T-C:</span> NCG2 / NCG3</div>
                <div><span className="font-mono font-medium">MWG T-C:</span> MWG2 / MWG3</div>
                <div><span className="font-mono font-medium">NCG T-D:</span> NCG5 / NCG6</div>
                <div><span className="font-mono font-medium">NCG T-E:</span> NCG5 / NCG6</div>
              </div>
              <p className="mt-1">
                Conflicts are flagged when a transformer WO overlaps with equipment work (MSB, EG, UPS, PTX) in either of the paired buildings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
