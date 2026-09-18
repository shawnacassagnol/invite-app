import { Routes } from '@angular/router';
import { EventListComponent } from './event-list.component';
import { EventDetailComponent } from './event-detail.component';
import { PublicInviteComponent } from './public-invite.component';

// Maps URLs to components:
//   ''            → the event list (home page)
//   'event/:id'   → the detail page for a specific event (:id is the event's id)
//   'invite/:token' → the PUBLIC read-only invite page (:token is the share token)
export const routes: Routes = [
  { path: '', component: EventListComponent },
  { path: 'event/:id', component: EventDetailComponent },
  { path: 'invite/:token', component: PublicInviteComponent }
];
