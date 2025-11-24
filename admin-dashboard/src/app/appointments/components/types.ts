export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

export interface Appointment {
  id: number;
  customer_id: number;
  calendar_event_id?: string;
  appointment_datetime: string;
  service_type: string;
  provider?: string;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled";
  booked_by: string;
  special_requests?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  customer?: Customer;
}

export interface AppointmentRequest {
  id: string;
  created_at: string;
  channel: string;
  status: string;
  requested_time_window?: string | null;
  service_type?: string | null;
  customer?: {
    id: number;
    name: string;
    phone?: string | null;
  } | null;
  note?: string | null;
}

