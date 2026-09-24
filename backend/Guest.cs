// Describes a guest invited to an event
public class Guest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public bool Invited { get; set; } = false;   // has an invite been "sent"?

    // This guest's RSVP status: "pending", "yes", "no", or "maybe".
    // Starts as "pending" until the guest responds.
    public string Rsvp { get; set; } = "pending";

    // The foreign key — links this guest to an event.
    // "This guest belongs to the event with this EventId."
    public int EventId { get; set; }
}
