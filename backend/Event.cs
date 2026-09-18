// Describes a single event/invitation
public class Event
{
    public int Id { get; set; }              // unique identifier
    public string Title { get; set; } = "";  // e.g. "Shawna's Birthday Party"
    public string Date { get; set; } = "";   // e.g. "2026-09-12"
    public string Location { get; set; } = ""; // e.g. "Atlanta, GA"
    public string Description { get; set; } = "";

    // RSVP counters (default to 0)
    public int Yes { get; set; } = 0;
    public int No { get; set; } = 0;
    public int Maybe { get; set; } = 0;

    // A random, unguessable token used for the public share link
    public string ShareToken { get; set; } = "";

    // The guests invited to this event (the "many" side of the relationship)
    public List<Guest> Guests { get; set; } = new();

    // The schedule/agenda items for this event
    public List<ScheduleItem> ScheduleItems { get; set; } = new();
}
