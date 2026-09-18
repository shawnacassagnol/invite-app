import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Event, Guest, ScheduleItem } from './models';

@Component({
  selector: 'app-event-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.css'
})
export class EventDetailComponent implements OnInit {
  backendUrl = 'http://localhost:5200';

  eventId = 0;
  event: Event | null = null;

  guests: Guest[] = [];
  guestName = '';
  guestEmail = '';
  guestPhone = '';
  inviteMessage = '';

  // Feedback message shown after copying the public share link
  shareMessage = '';

  // Edit mode
  editing = false;
  editTitle = '';
  editDate = '';
  editLocation = '';
  editDescription = '';

  // Map
  mapUrl: SafeResourceUrl | null = null;

  // DomSanitizer is needed to safely use an external URL in an iframe
  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {}

  // Schedule
  schedule: ScheduleItem[] = [];
  scheduleTime = '';
  scheduleActivity = '';

  // Which schedule item is being edited (null = none)
  editingItemId: number | null = null;
  editItemTime = '';
  editItemActivity = '';

  ngOnInit() {
    // Read the "id" from the URL and convert it to a number
    this.eventId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadEvent();
    this.loadGuests();
    this.loadSchedule();
  }

  loadSchedule() {
    this.http.get<ScheduleItem[]>(`${this.backendUrl}/api/events/${this.eventId}/schedule`).subscribe({
      next: (data) => this.schedule = data
    });
  }

  addScheduleItem() {
    if (this.scheduleActivity.trim() === '') return;
    const newItem = { time: this.scheduleTime, activity: this.scheduleActivity };
    this.http.post<ScheduleItem>(`${this.backendUrl}/api/events/${this.eventId}/schedule`, newItem).subscribe({
      next: (created) => {
        this.schedule.push(created);
        this.scheduleTime = '';
        this.scheduleActivity = '';
      }
    });
  }

  deleteScheduleItem(itemId: number) {
    this.http.delete(`${this.backendUrl}/api/schedule/${itemId}`).subscribe({
      next: () => this.schedule = this.schedule.filter(s => s.id !== itemId)
    });
  }

  // Start editing a schedule item (fill the edit fields with its current values)
  startEditItem(item: ScheduleItem) {
    this.editingItemId = item.id;
    this.editItemTime = item.time;
    this.editItemActivity = item.activity;
  }

  cancelEditItem() {
    this.editingItemId = null;
  }

  // Save the edited schedule item
  saveEditItem(item: ScheduleItem) {
    const updated = { time: this.editItemTime, activity: this.editItemActivity };
    this.http.put<ScheduleItem>(`${this.backendUrl}/api/schedule/${item.id}`, updated).subscribe({
      next: (result) => {
        item.time = result.time;         // update the local item
        item.activity = result.activity;
        this.editingItemId = null;       // exit edit mode
      }
    });
  }

  loadEvent() {
    this.http.get<Event>(`${this.backendUrl}/api/events/${this.eventId}`).subscribe({
      next: (data) => {
        this.event = data;
        this.loadMap(data.location);   // geocode the location and show the map
      }
    });
  }

  // Geocode the address, then build the OpenStreetMap embed URL
  loadMap(location: string) {
    if (!location) return;
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
    this.http.get<any[]>(geoUrl).subscribe({
      next: (results) => {
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          // Build a small bounding box around the point for the embed.
          // Smaller d = tighter box = more zoomed in.
          const d = 0.003;
          const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
          const raw = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lon}`;
          // Sanitize so Angular allows it inside an iframe
          this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(raw);
        }
      }
    });
  }

  // ----- Edit mode -----
  startEdit() {
    if (!this.event) return;
    this.editing = true;
    this.editTitle = this.event.title;
    this.editDate = this.event.date;
    this.editLocation = this.event.location;
    this.editDescription = this.event.description;
  }

  cancelEdit() {
    this.editing = false;
  }

  saveEdit() {
    if (!this.event) return;
    const updated = {
      title: this.editTitle,
      date: this.editDate,
      location: this.editLocation,
      description: this.editDescription
    };
    this.http.put<Event>(`${this.backendUrl}/api/events/${this.eventId}`, updated).subscribe({
      next: (data) => {
        this.event = data;
        this.editing = false;
        this.loadMap(data.location);   // refresh the map in case location changed
      }
    });
  }

  loadGuests() {
    this.http.get<Guest[]>(`${this.backendUrl}/api/events/${this.eventId}/guests`).subscribe({
      next: (data) => this.guests = data
    });
  }

  rsvp(response: string) {
    if (!this.event) return;
    this.http.put<Event>(`${this.backendUrl}/api/events/${this.eventId}/rsvp/${response}`, {}).subscribe({
      next: (updated) => this.event = updated
    });
  }

  // Build the public invite URL and copy it to the clipboard
  copyShareLink() {
    if (!this.event) return;
    const link = `http://localhost:4400/invite/${this.event.shareToken}`;
    navigator.clipboard.writeText(link).then(() => {
      this.shareMessage = 'Link copied! Share it with your guests. 🔗';
    });
  }

  addGuest() {
    if (this.guestName.trim() === '') return;
    const newGuest = { name: this.guestName, email: this.guestEmail, phone: this.guestPhone };
    this.http.post<Guest>(`${this.backendUrl}/api/events/${this.eventId}/guests`, newGuest).subscribe({
      next: (created) => {
        this.guests.push(created);
        this.guestName = '';
        this.guestEmail = '';
        this.guestPhone = '';
      }
    });
  }

  deleteGuest(guestId: number) {
    this.http.delete(`${this.backendUrl}/api/guests/${guestId}`).subscribe({
      next: () => this.guests = this.guests.filter(g => g.id !== guestId)
    });
  }

  sendInvites() {
    this.http.post<{ sent: number }>(`${this.backendUrl}/api/events/${this.eventId}/send-invites`, {}).subscribe({
      next: (result) => {
        this.inviteMessage = `Invites sent to ${result.sent} guest(s)! 🎉`;
        this.loadGuests();
      },
      error: () => this.inviteMessage = 'No guests to invite yet.'
    });
  }
}
