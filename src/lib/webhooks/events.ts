import { z } from 'zod'

export const callStartedSchema = z.object({
  event_type: z.literal('call.started'),
  session_id: z.string().min(1),
  did_number: z.string().min(1),
})

export const callCompletedSchema = z.object({
  event_type: z.literal('call.completed'),
  session_id: z.string().min(1),
  did_number: z.string().min(1),
  duration_seconds: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'completed', 'failed', 'forwarded', 'abandoned']).optional(),
  intent_main: z.string().optional(),
  intent_sub: z.string().optional(),
  phone_hash: z.string().optional(),
  language_code: z.string().optional(),
  summary_short: z.string().optional(),
  summary_structured: z.record(z.string(), z.unknown()).optional(),
  transcript_text: z.string().optional(),
  pid_status: z.enum(['identified', 'not_found', 'multiple', 'no_pid']).optional(),
  patient_recognized: z.boolean().optional(),
  inbox_qualifying: z.boolean().optional(),
  case_type: z.enum([
    'unidentified_patient', 'invalid_pid', 'multiple_pid', 'callback_needed',
    'prescription_blocked', 'unclear_intent', 'emergency', 'technical_error',
  ]).optional(),
})

export const webhookEventSchema = z.discriminatedUnion('event_type', [
  callStartedSchema,
  callCompletedSchema,
])

export type CallStartedEvent = z.infer<typeof callStartedSchema>
export type CallCompletedEvent = z.infer<typeof callCompletedSchema>
export type WebhookEvent = z.infer<typeof webhookEventSchema>
