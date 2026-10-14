class PatientTimelineService {
  async getTimeline(userId) {
    // In a real DB, we'd query Prescriptions, Orders, Reminders sorted by date.
    // For Phase 8 MVP, returning a simulated but dynamic timeline graph based on logic.
    return [
      {
        id: "ev1",
        type: "prescription_uploaded",
        medicine: "Metformin 500mg",
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        source: "OCR Upload",
        details: "Dr. Smith - 30 days supply"
      },
      {
        id: "ev2",
        type: "medicine_purchased",
        medicine: "Metformin 500mg",
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        source: "Pharmacy Checkout",
        details: "Order #ORD-99231"
      },
      {
        id: "ev3",
        type: "reminder_completed",
        medicine: "Metformin 500mg",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        source: "Smart Reminders",
        details: "Morning dose taken"
      },
      {
        id: "ev4",
        type: "reminder_missed",
        medicine: "Metformin 500mg",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        source: "Smart Reminders",
        details: "Evening dose missed"
      }
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

module.exports = new PatientTimelineService();
