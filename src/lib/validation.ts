import { z } from "zod";

export const bookingSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email address").trim(),
  phone: z.string().trim().min(7, "Phone number is required").max(20).regex(/^[\d\s()+-]+$/, "Enter a valid phone number"),
  preferredDate: z.string().min(1, "Date is required"),
  preferredTime: z.string().min(1, "Time is required"),
  location: z.string().trim().min(1, "Location of interest is required").max(300),
  agentName: z.string().trim().max(200).optional().or(z.literal("")),
});

export type BookingSubmissionInput = z.infer<typeof bookingSubmissionSchema>;

// expectedUpdatedAt: the ISO timestamp the client last saw for this booking.
// When present, the server rejects the write if the row has changed since
// (optimistic concurrency prevents two admins from silently clobbering
// each other's changes).
const concurrency = { expectedUpdatedAt: z.string().optional() };

// note: an optional free-text comment the admin can attach to a status
// change, recorded on that action's BookingActivity entry.
const note = { note: z.string().trim().max(1000).optional() };

export const agentCategorySchema = z.enum(["staff", "hire_purchase"]);

export const agentSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  phone: z.string().trim().min(7, "Phone is required").max(20).regex(/^[\d\s()+-]+$/, "Enter a valid phone number"),
  category: agentCategorySchema.default("staff"),
  isActive: z.boolean().optional().default(true),
});

export const agentUpdateSchema = agentSchema.partial();

export type AgentInput = z.infer<typeof agentSchema>;
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;

export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), ...note, ...concurrency }),
  z.object({
    action: z.literal("reschedule"),
    rescheduledDate: z
      .string()
      .min(1, "New date is required")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
    rescheduledTime: z.string().min(1, "New time is required"),
    notifyClient: z.boolean().optional().default(true),
    ...note,
    ...concurrency,
  }),
  z.object({ action: z.literal("hold"), ...note, ...concurrency }),
  z.object({
    action: z.literal("under_review"),
    assignedToId: z.string().min(1).nullable().optional(),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("mark_active"),
    internalNote: z.string().trim().min(1, "Internal note is required"),
    ...concurrency,
  }),
  z.object({
    action: z.literal("record_outcome"),
    outcome: z.enum(["sold", "interested", "not_sold"]),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("save"),
    // agentName is now read-only visitor raw text save no longer binds agent; use assign_agent
    assignedToId: z.string().min(1).nullable().optional(),
    ...concurrency,
  }),
  z.object({
    action: z.literal("escalate_lead"),
    leadTemperature: z.enum(["warm", "hot"]),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("cool_down"),
    leadTemperature: z.enum(["cold", "warm"]),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("assign_agent"),
    agentId: z.string().min(1).nullable(),
    silent: z.boolean().optional().default(false),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("add_note"),
    body: z.string().trim().min(1).max(5000),
    ...concurrency,
  }),
  z.object({
    action: z.literal("confirm_agent"),
    ...concurrency,
  }),
  z.object({
    action: z.literal("reopen"),
    reason: z.string().trim().min(3, "Reason is required").max(1000),
    ...concurrency,
  }),
  z.object({
    action: z.literal("edit_booking"),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(20).optional(),
    location: z.string().trim().min(1).max(300).optional(),
    preferredDate: z.string().optional(),
    preferredTime: z.string().optional(),
    ...concurrency,
  }),
]);

export type BookingActionInput = z.infer<typeof bookingActionSchema>;
