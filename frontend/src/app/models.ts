// Shared data models used across components.

// Matches Event.cs on the backend
export interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  description: string;
  yes: number;
  no: number;
  maybe: number;
  shareToken: string;
}

// Matches Guest.cs on the backend
export interface Guest {
  id: number;
  name: string;
  email: string;
  phone: string;
  invited: boolean;
  rsvp: string;      // "pending" | "yes" | "no" | "maybe"
  eventId: number;
}

// Matches ScheduleItem.cs on the backend
export interface ScheduleItem {
  id: number;
  time: string;
  activity: string;
  eventId: number;
}
