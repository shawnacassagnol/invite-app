using Microsoft.EntityFrameworkCore;

// The database context — represents our database and its tables.
// Entity Framework Core uses this to translate C# operations into SQL.
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // This represents the "Events" table in the database.
    // Each row in the table = one Event object.
    public DbSet<Event> Events { get; set; }

    // The "Guests" table — each row = one Guest linked to an Event.
    public DbSet<Guest> Guests { get; set; }

    // The "ScheduleItems" table — each row = one agenda item linked to an Event.
    public DbSet<ScheduleItem> ScheduleItems { get; set; }
}
