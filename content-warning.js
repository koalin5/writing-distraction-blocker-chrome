// Injected into unlocked site tabs to warn before leaving

window.addEventListener("beforeunload", (e) => {
  e.preventDefault();
  // Chrome shows a generic "Leave site?" dialog. The returnValue string
  // is ignored by modern browsers but required to trigger the dialog.
  e.returnValue = "";
});
