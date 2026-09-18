import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Event } from './models';

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

  resetForm() {
    this.newTitle = '';
    this.newDate = '';
    this.newLocation = '';
    this.newDescription = '';
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
