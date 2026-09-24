import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Event } from './models';

// One address suggestion from the Nominatim geocoder
interface AddressSuggestion {
  display_name: string;   // the full, formatted address
}

interface CalendarDay {
  day: number | null;
  events: Event[];
}

@Component({
  selector: 'app-event-list',
  imports: [CommonModule, FormsModule, RouterLink],   // RouterLink lets us link to detail pages
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.css'
})
export class EventListComponent implements OnInit {
  backendUrl = 'http://localhost:5200';
  events: Event[] = [];

  view = 'list';
  currentMonth = new Date().getMonth();
  currentYear = new Date().getFullYear();
  monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  selectedDay: CalendarDay | null = null;

  // Add-event form fields
  newTitle = '';
  newDate = '';
  newLocation = '';
  newDescription = '';
  showForm = false;

  // ----- Location autocomplete -----
  addressSuggestions: AddressSuggestion[] = [];
  showSuggestions = false;
  private debounceTimer: any = null;   // used to wait until the user stops typing

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadEvents();
  }

  loadEvents() {
    this.http.get<Event[]>(`${this.backendUrl}/api/events`).subscribe({
      next: (data) => this.events = data
    });
  }

  setView(v: string) {
    this.view = v;
    this.selectedDay = null;
  }

  get calendarDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(this.currentYear, this.currentMonth, 1).getDay();

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, events: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(this.currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
      const dayEvents = this.events.filter(e => e.date === dateStr);
      days.push({ day: d, events: dayEvents });
    }
    return days;
  }

  prevMonth() {
    this.selectedDay = null;
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else { this.currentMonth--; }
  }

  nextMonth() {
    this.selectedDay = null;
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else { this.currentMonth++; }
  }

  selectDay(day: CalendarDay) {
    if (day.day === null) return;
    this.selectedDay = day;
  }

  toggleForm() {
    this.showForm = !this.showForm;
  }

  // Called on every keystroke in the Location field.
  // Debounced: we wait 350ms after typing stops before calling the API,
  // so we don't fire a request on every single letter.
  onLocationInput() {
    clearTimeout(this.debounceTimer);

    const query = this.newLocation.trim();
    if (query.length < 3) {          // don't search on 1-2 characters
      this.addressSuggestions = [];
      this.showSuggestions = false;
      return;
    }

    this.debounceTimer = setTimeout(() => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(query)}`;
      this.http.get<AddressSuggestion[]>(url).subscribe({
        next: (results) => {
          this.addressSuggestions = results;
          this.showSuggestions = results.length > 0;
        }
      });
    }, 350);
  }

  // User clicked a suggestion → fill the field with the full address
  selectAddress(suggestion: AddressSuggestion) {
    this.newLocation = suggestion.display_name;
    this.addressSuggestions = [];
    this.showSuggestions = false;
  }

  // Close the dropdown when the user clicks anywhere outside the location field
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.location-autocomplete')) {
      this.showSuggestions = false;
    }
  }

  resetForm() {
    this.newTitle = '';
    this.newDate = '';
    this.newLocation = '';
    this.newDescription = '';
    this.addressSuggestions = [];
    this.showSuggestions = false;
  }

  addEvent() {
    if (this.newTitle.trim() === '' || this.newDate.trim() === '') return;
    const newEvent = {
      title: this.newTitle,
      date: this.newDate,
      location: this.newLocation,
      description: this.newDescription
    };
    this.http.post<Event>(`${this.backendUrl}/api/events`, newEvent).subscribe({
      next: (created) => {
        this.events.push(created);
        this.resetForm();
        this.showForm = false;
      }
    });
  }

  deleteEvent(id: number) {
    this.http.delete(`${this.backendUrl}/api/events/${id}`).subscribe({
      next: () => this.events = this.events.filter(e => e.id !== id)
    });
  }
}
