import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// A public, read-only shape of an event (matches what /api/invite/{token} returns)
interface PublicEvent {
  id: number;
  title: string;
  date: string;
  location: string;
  description: string;
  yes: number;
  no: number;
  maybe: number;
  schedule: { id: number; time: string; activity: string }[];
}

@Component({
  selector: 'app-public-invite',
  imports: [CommonModule],
  templateUrl: './public-invite.component.html',
  styleUrl: './public-invite.component.css'
})
export class PublicInviteComponent implements OnInit {
  backendUrl = 'http://localhost:5200';

  token = '';
  event: PublicEvent | null = null;
  notFound = false;
  rsvpDone = false;
  mapUrl: SafeResourceUrl | null = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    // Read the token from the URL (/invite/abc123 → token = "abc123")
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.loadEvent();
  }

  loadEvent() {
    this.http.get<PublicEvent>(`${this.backendUrl}/api/invite/${this.token}`).subscribe({
      next: (data) => {
        this.event = data;
        this.loadMap(data.location);
      },
      error: () => this.notFound = true   // invalid token → show "not found"
    });
  }

  loadMap(location: string) {
    if (!location) return;
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
    this.http.get<any[]>(geoUrl).subscribe({
      next: (results) => {
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          const d = 0.003;
          const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
          const raw = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lon}`;
          this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(raw);
        }
      }
    });
  }

  rsvp(response: string) {
    this.http.put<{ yes: number; no: number; maybe: number }>(
      `${this.backendUrl}/api/invite/${this.token}/rsvp/${response}`, {}
    ).subscribe({
      next: (counts) => {
        if (this.event) {
          this.event.yes = counts.yes;
          this.event.no = counts.no;
          this.event.maybe = counts.maybe;
        }
        this.rsvpDone = true;
      }
    });
  }
}
