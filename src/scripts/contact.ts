declare global {
  interface Window {
    onTurnstileError: () => boolean;
    turnstile?: { reset: () => void };
  }
}

const form = document.querySelector<HTMLFormElement>("#contact-form");
const status = document.querySelector<HTMLElement>("#form-status");

window.onTurnstileError = () => {
  if (status)
    status.textContent = "The verification could not load. Please try again.";
  return true;
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const data = new FormData(form);
  const payload = {
    name: data.get("name"),
    email: data.get("email"),
    subject: data.get("subject"),
    message: data.get("message"),
    website: data.get("website"),
    turnstileToken: data.get("cf-turnstile-response"),
  };

  if (submit) submit.disabled = true;
  if (status) status.textContent = "Sending…";

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok)
      throw new Error(result.message ?? "The message could not be sent.");

    form.reset();
    window.turnstile?.reset();
    if (status) status.textContent = result.message ?? "Message sent.";
  } catch (error) {
    if (status) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "The message could not be sent.";
    }
  } finally {
    if (submit) submit.disabled = false;
  }
});

export {};
