(() => {
  const form = document.getElementById("adminLogin");
  const input = document.getElementById("adminCode");
  const button = document.getElementById("loginButton");
  const message = document.getElementById("loginMessage");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "";
    message.classList.remove("success");
    if (!input.value) {
      message.textContent = "יש להזין קוד מנהל.";
      input.focus();
      return;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: input.value })
      });
      const result = await response.json().catch(() => ({}));
      input.value = "";
      if (!response.ok || result.ok !== true) {
        message.textContent = result.message || "הכניסה נכשלה. נסה שוב מאוחר יותר.";
        input.focus();
        return;
      }
      message.textContent = "הכניסה אושרה. פותח את האולפן…";
      message.classList.add("success");
      window.location.replace("/");
    } catch {
      input.value = "";
      message.textContent = "לא ניתן להתחבר כרגע. בדוק את החיבור ונסה שוב.";
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
})();
