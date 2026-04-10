const mobileNavToggle = document.getElementById("mobile-nav-toggle");
const mobileNavPanel = document.getElementById("mobile-nav-panel");
const mobileNavLinks = mobileNavPanel ? mobileNavPanel.querySelectorAll("a") : [];
const animatedElements = document.querySelectorAll(".animate-on-scroll");

const setMobileNavState = (isOpen) => {
  if (!mobileNavToggle || !mobileNavPanel) {
    return;
  }

  mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
  mobileNavToggle.classList.toggle("is-open", isOpen);
  mobileNavPanel.hidden = !isOpen;
  document.body.classList.toggle("is-nav-open", isOpen);
};

if (mobileNavToggle && mobileNavPanel) {
  mobileNavToggle.addEventListener("click", () => {
    const isOpen = mobileNavToggle.getAttribute("aria-expanded") === "true";
    setMobileNavState(!isOpen);
  });

  mobileNavLinks.forEach((link) => {
    link.addEventListener("click", () => setMobileNavState(false));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 767) {
      setMobileNavState(false);
    }
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        activeObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );

  animatedElements.forEach((element) => {
    if (!element.classList.contains("is-visible")) {
      observer.observe(element);
    }
  });
} else {
  animatedElements.forEach((element) => element.classList.add("is-visible"));
}
