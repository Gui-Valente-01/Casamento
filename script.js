const form = document.querySelector("#rsvp-form");
const note = document.querySelector("#form-note");

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const guests = String(data.get("guests") || "").trim();
  const message = String(data.get("message") || "").trim();

  if (!name || !guests) {
    note.textContent = "Preencha seu nome e numero de convidados.";
    return;
  }

  const confirmation = [
    `Confirmacao para o casamento de Laura e Guilherme`,
    `Nome: ${name}`,
    `Convidados: ${guests}`,
    message ? `Recado: ${message}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  note.textContent = "Confirmacao gerada. Agora e so copiar e enviar aos noivos.";

  if (navigator.clipboard) {
    navigator.clipboard.writeText(confirmation).catch(() => {});
  }
});
