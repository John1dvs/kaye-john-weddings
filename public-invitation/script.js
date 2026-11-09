
/* KAYE & JOHN WEDDING INVITATION
   COUNTDOWN + SUPABASE RSVP
*/

const SUPABASE_URL = "https://xypwetpywwxwnwplvtew.supabase.co";
const SUPABASE_KEY = "sb_publishable_XjxlObz5z3B-X7fH8dkweg_R4C-u51W";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Wedding date: July 23, 2035
// Month 6 means July because JavaScript months start at 0.
const weddingDate = new Date(2035, 6, 23, 0, 0, 0).getTime();

function updateCountdown() {
  const now = new Date().getTime();
  const distance = weddingDate - now;

  const daysElement = document.getElementById("days");
  const hoursElement = document.getElementById("hours");
  const minutesElement = document.getElementById("minutes");
  const secondsElement = document.getElementById("seconds");

  if (
    !daysElement ||
    !hoursElement ||
    !minutesElement ||
    !secondsElement
  ) {
    return;
  }

  if (distance <= 0) {
    daysElement.textContent = "0";
    hoursElement.textContent = "00";
    minutesElement.textContent = "00";
    secondsElement.textContent = "00";
    return;
  }

  const days = Math.floor(
    distance / (1000 * 60 * 60 * 24)
  );

  const hours = Math.floor(
    (distance % (1000 * 60 * 60 * 24)) /
    (1000 * 60 * 60)
  );

  const minutes = Math.floor(
    (distance % (1000 * 60 * 60)) /
    (1000 * 60)
  );

  const seconds = Math.floor(
    (distance % (1000 * 60)) / 1000
  );

  daysElement.textContent = days;
  hoursElement.textContent = String(hours).padStart(2, "0");
  minutesElement.textContent = String(minutes).padStart(2, "0");
  secondsElement.textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);


// RSVP FORM
const form = document.getElementById("rsvpForm");
const feedback = document.getElementById("rsvpFeedback");
const submitButton = document.getElementById("rsvpButton");

if (form && feedback) {
  form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document
      .getElementById("guestName")
      .value.trim();

    const attendance = document
      .getElementById("attendance")
      .value;

    const message = document
      .getElementById("message")
      .value.trim();

    if (!name || !attendance) {
      feedback.textContent =
        "Please enter your name and select your attendance.";
      return;
    }

    feedback.textContent = "Sending your RSVP...";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "SENDING...";
    }

    try {
      const { error } = await supabaseClient
        .from("wedding_rsvps")
        .insert([
          {
            guest_name: name,
            attendance: attendance,
            message: message
          }
        ]);

      if (error) {
        throw error;
      }

      feedback.textContent =
        `Thank you, ${name}! Your RSVP has been saved successfully.`;

      form.reset();

    } catch (error) {
      console.error("RSVP ERROR:", error);

      feedback.textContent =
        "Sorry, your RSVP could not be saved. Please try again.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "SEND RSVP";
      }
    }
  });
}
