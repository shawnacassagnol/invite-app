using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Handle circular references (Event → Guests → Event) when converting to JSON
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Register the database context, using a SQLite file called "invite.db"
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=invite.db"));

// Allow the Angular frontend to call this backend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:4300", "http://localhost:4400")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// On startup: create the database file & tables if they don't exist yet,
// and seed a couple of sample events the very first time.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    if (!db.Events.Any())
    {
        db.Events.Add(new Event { Title = "Team Lunch", Date = "2026-09-20", Location = "Atlanta, GA", Description = "Casual team lunch.", ShareToken = Guid.NewGuid().ToString("N").Substring(0, 8) });
        db.Events.Add(new Event { Title = "Birthday Party", Date = "2026-09-12", Location = "Snellville, GA", Description = "Flowers and butterflies theme!", ShareToken = Guid.NewGuid().ToString("N").Substring(0, 8) });
        db.SaveChanges();
    }

    // Backfill: any existing event missing a share token gets one.
    // (Covers events seeded before tokens existed, so old share links work.)
    var tokenless = db.Events.Where(e => e.ShareToken == "" || e.ShareToken == null).ToList();
    foreach (var ev in tokenless)
    {
        ev.ShareToken = Guid.NewGuid().ToString("N").Substring(0, 8);
    }
    if (tokenless.Count > 0) db.SaveChanges();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAngular");

// -------------------------------------------------------------
// GET /api/events  →  return all events (reads from the database)
// -------------------------------------------------------------
app.MapGet("/api/events", async (AppDbContext db) =>
{
    var events = await db.Events.ToListAsync();
    return Results.Ok(events);
});

// -------------------------------------------------------------
// GET /api/events/{id}  →  return one event
// -------------------------------------------------------------
app.MapGet("/api/events/{id}", async (int id, AppDbContext db) =>
{
    var ev = await db.Events.FindAsync(id);
    return ev is null ? Results.NotFound() : Results.Ok(ev);
});

// -------------------------------------------------------------
// POST /api/events  →  create a new event (saves to the database)
// -------------------------------------------------------------
app.MapPost("/api/events", async (Event newEvent, AppDbContext db) =>
{
    // Generate a random, unguessable share token (8 characters)
    newEvent.ShareToken = Guid.NewGuid().ToString("N").Substring(0, 8);

    db.Events.Add(newEvent);       // EF assigns the Id automatically
    await db.SaveChangesAsync();   // write to the database
    return Results.Created($"/api/events/{newEvent.Id}", newEvent);
});

// -------------------------------------------------------------
// GET /api/invite/{token}  →  PUBLIC: look up an event by its share token
// This is the read-only endpoint guests use (no admin access).
// -------------------------------------------------------------
app.MapGet("/api/invite/{token}", async (string token, AppDbContext db) =>
{
    var ev = await db.Events.FirstOrDefaultAsync(e => e.ShareToken == token);
    if (ev is null) return Results.NotFound();

    var schedule = await db.ScheduleItems.Where(s => s.EventId == ev.Id).ToListAsync();

    // Return only the public-safe info (no guest list, no share token needed back)
    return Results.Ok(new
    {
        ev.Id,
        ev.Title,
        ev.Date,
        ev.Location,
        ev.Description,
        ev.Yes,
        ev.No,
        ev.Maybe,
        Schedule = schedule
    });
});

// -------------------------------------------------------------
// PUT /api/invite/{token}/rsvp/{response}  →  PUBLIC: RSVP via share link
// -------------------------------------------------------------
app.MapPut("/api/invite/{token}/rsvp/{response}", async (string token, string response, AppDbContext db) =>
{
    var ev = await db.Events.FirstOrDefaultAsync(e => e.ShareToken == token);
    if (ev is null) return Results.NotFound();

    if (response == "yes") ev.Yes++;
    else if (response == "no") ev.No++;
    else if (response == "maybe") ev.Maybe++;
    else return Results.BadRequest();

    await db.SaveChangesAsync();
    return Results.Ok(new { ev.Yes, ev.No, ev.Maybe });
});

// -------------------------------------------------------------
// PUT /api/events/{id}  →  update an event's details
// -------------------------------------------------------------
app.MapPut("/api/events/{id}", async (int id, Event updated, AppDbContext db) =>
{
    var ev = await db.Events.FindAsync(id);
    if (ev is null) return Results.NotFound();

    // Update the editable fields (keep RSVP counts as they were)
    ev.Title = updated.Title;
    ev.Date = updated.Date;
    ev.Location = updated.Location;
    ev.Description = updated.Description;

    await db.SaveChangesAsync();
    return Results.Ok(ev);
});

// -------------------------------------------------------------
// DELETE /api/events/{id}  →  remove an event from the database
// -------------------------------------------------------------
app.MapDelete("/api/events/{id}", async (int id, AppDbContext db) =>
{
    var ev = await db.Events.FindAsync(id);
    if (ev is null) return Results.NotFound();
    db.Events.Remove(ev);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// -------------------------------------------------------------
// PUT /api/events/{id}/rsvp/{response}  →  add one RSVP
// {response} is "yes", "no", or "maybe"
// -------------------------------------------------------------
app.MapPut("/api/events/{id}/rsvp/{response}", async (int id, string response, AppDbContext db) =>
{
    var ev = await db.Events.FindAsync(id);
    if (ev is null) return Results.NotFound();

    // Increment the matching counter
    if (response == "yes") ev.Yes++;
    else if (response == "no") ev.No++;
    else if (response == "maybe") ev.Maybe++;
    else return Results.BadRequest("Response must be yes, no, or maybe.");

    await db.SaveChangesAsync();   // save the updated count to the database
    return Results.Ok(ev);          // return the updated event
});

// -------------------------------------------------------------
// GET /api/events/{id}/guests  →  list guests for one event
// -------------------------------------------------------------
app.MapGet("/api/events/{id}/guests", async (int id, AppDbContext db) =>
{
    var guests = await db.Guests.Where(g => g.EventId == id).ToListAsync();
    return Results.Ok(guests);
});

// -------------------------------------------------------------
// POST /api/events/{id}/guests  →  add a guest to an event
// -------------------------------------------------------------
app.MapPost("/api/events/{id}/guests", async (int id, Guest newGuest, AppDbContext db) =>
{
    var ev = await db.Events.FindAsync(id);
    if (ev is null) return Results.NotFound("Event not found.");

    newGuest.EventId = id;          // link this guest to the event
    db.Guests.Add(newGuest);
    await db.SaveChangesAsync();
    return Results.Created($"/api/guests/{newGuest.Id}", newGuest);
});

// -------------------------------------------------------------
// DELETE /api/guests/{guestId}  →  remove a guest
// -------------------------------------------------------------
app.MapDelete("/api/guests/{guestId}", async (int guestId, AppDbContext db) =>
{
    var guest = await db.Guests.FindAsync(guestId);
    if (guest is null) return Results.NotFound();
    db.Guests.Remove(guest);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// -------------------------------------------------------------
// PUT /api/guests/{guestId}/rsvp/{response}  →  set ONE guest's RSVP
// {response} is "yes", "no", or "maybe". This is the "named" RSVP:
// we record which specific guest responded what.
// -------------------------------------------------------------
app.MapPut("/api/guests/{guestId}/rsvp/{response}", async (int guestId, string response, AppDbContext db) =>
{
    if (response != "yes" && response != "no" && response != "maybe")
        return Results.BadRequest("Response must be yes, no, or maybe.");

    var guest = await db.Guests.FindAsync(guestId);
    if (guest is null) return Results.NotFound();

    guest.Rsvp = response;         // record this guest's answer by name
    await db.SaveChangesAsync();
    return Results.Ok(guest);
});

// -------------------------------------------------------------
// POST /api/events/{id}/send-invites  →  SIMULATE sending invites
// Marks all guests as invited and returns a summary.
// (Real email/SMS would happen here in a future phase.)
// -------------------------------------------------------------
app.MapPost("/api/events/{id}/send-invites", async (int id, AppDbContext db) =>
{
    var guests = await db.Guests.Where(g => g.EventId == id).ToListAsync();
    if (guests.Count == 0) return Results.BadRequest("No guests to invite.");

    foreach (var g in guests)
    {
        g.Invited = true;
        // In a real app, this is where you'd send an email/SMS to g.Email / g.Phone
        Console.WriteLine($"[SIMULATED] Invite sent to {g.Name} ({g.Email}, {g.Phone})");
    }
    await db.SaveChangesAsync();

    return Results.Ok(new { sent = guests.Count });
});

// -------------------------------------------------------------
// GET /api/events/{id}/schedule  →  list schedule items for an event
// -------------------------------------------------------------
app.MapGet("/api/events/{id}/schedule", async (int id, AppDbContext db) =>
{
    var items = await db.ScheduleItems.Where(s => s.EventId == id).ToListAsync();
    return Results.Ok(items);
});

// -------------------------------------------------------------
// POST /api/events/{id}/schedule  →  add a schedule item
// -------------------------------------------------------------
app.MapPost("/api/events/{id}/schedule", async (int id, ScheduleItem newItem, AppDbContext db) =>
{
    var ev = await db.Events.FindAsync(id);
    if (ev is null) return Results.NotFound("Event not found.");

    newItem.EventId = id;
    db.ScheduleItems.Add(newItem);
    await db.SaveChangesAsync();
    return Results.Created($"/api/schedule/{newItem.Id}", newItem);
});

// -------------------------------------------------------------
// PUT /api/schedule/{itemId}  →  edit a schedule item
// -------------------------------------------------------------
app.MapPut("/api/schedule/{itemId}", async (int itemId, ScheduleItem updated, AppDbContext db) =>
{
    var item = await db.ScheduleItems.FindAsync(itemId);
    if (item is null) return Results.NotFound();

    item.Time = updated.Time;
    item.Activity = updated.Activity;

    await db.SaveChangesAsync();
    return Results.Ok(item);
});

// -------------------------------------------------------------
// DELETE /api/schedule/{itemId}  →  remove a schedule item
// -------------------------------------------------------------
app.MapDelete("/api/schedule/{itemId}", async (int itemId, AppDbContext db) =>
{
    var item = await db.ScheduleItems.FindAsync(itemId);
    if (item is null) return Results.NotFound();
    db.ScheduleItems.Remove(item);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();
