import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as workOrderDb from "./workOrderDb";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  workOrders: router({
    upload: publicProcedure
      .input(z.object({
        workOrders: z.array(z.object({
          workOrderNumber: z.string(),
          description: z.string().optional(),
          dataCenter: z.string().optional(),
          schedStartDate: z.string().optional(),
          assignedToName: z.string().optional(),
          status: z.string().optional(),
          type: z.string().optional(),
          equipmentDescription: z.string().optional(),
          priority: z.string().optional(),
          shift: z.string().optional(),
          ehsLor: z.string().optional(),
          operationalLor: z.string().optional(),
          deferralReasonSelected: z.string().optional(),
          trade: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user?.id ?? 1; // Default to 1 if no user
        const orders = input.workOrders.map(wo => ({
          ...wo,
          uploadedBy: userId,
        }));
        await workOrderDb.uploadWorkOrders(orders);
        return { success: true, count: orders.length };
      }),

    list: publicProcedure.query(async () => {
      return await workOrderDb.getAllWorkOrders();
    }),
  }),

  scheduledLabor: router({
    upload: publicProcedure
      .input(z.object({
        labor: z.array(z.object({
          workOrderNumber: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user?.id ?? 1;
        const labor = input.labor.map(l => ({
          ...l,
          uploadedBy: userId,
        }));
        await workOrderDb.uploadScheduledLabor(labor);
        return { success: true, count: labor.length };
      }),

    list: publicProcedure.query(async () => {
      return await workOrderDb.getAllScheduledLabor();
    }),
  }),

  scheduleLocks: router({
    lock: publicProcedure
      .input(z.object({
        locks: z.array(z.object({
          workOrderNumber: z.string(),
          description: z.string().optional(),
          dataCenter: z.string().optional(),
          schedStartDate: z.string().optional(),
          assignedToName: z.string().optional(),
          status: z.string().optional(),
          type: z.string().optional(),
          equipmentDescription: z.string().optional(),
          priority: z.string().optional(),
          shift: z.string().optional(),
          lockWeek: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user?.id ?? 1;
        const locks = input.locks.map(l => ({
          ...l,
          lockedBy: userId,
        }));
        await workOrderDb.lockWorkOrders(locks);
        return { success: true, count: locks.length };
      }),

    unlock: publicProcedure
      .input(z.object({
        workOrderNumbers: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        await workOrderDb.unlockWorkOrders(input.workOrderNumbers);
        return { success: true, count: input.workOrderNumbers.length };
      }),

    list: publicProcedure.query(async () => {
      return await workOrderDb.getAllScheduleLocks();
    }),
  }),
});

export type AppRouter = typeof appRouter;
