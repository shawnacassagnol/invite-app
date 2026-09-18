// Describes one item in an event's schedule/agenda
public class ScheduleItem
{
    public int Id { get; set; }
    public string Time { get; set; } = "";      // e.g. "3:00 PM"
    public string Activity { get; set; } = "";  // e.g. "Guests arrive"

    // Foreign key — links this schedule item to an event
    public int EventId { get; set; }
}
