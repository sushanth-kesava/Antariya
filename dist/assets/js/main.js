(function () {
  const data = window.AntariyaData || { products: [], testimonials: [] };
  const inLegalPage = window.location.pathname.includes("/legal/");
  const basePrefix = inLegalPage ? "../" : "";

  function formatPrice(price) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
  }

  function navbarTemplate() {
    const page = document.body.getAttribute("data-page") || "home";
    const active = (name) => (page === name ? "active" : "");

    return `
      <header class="site-header">
        <a href="${basePrefix}index.html" class="brand-mark" aria-label="Antariya Home">Antari</a>
        <nav class="nav-links" aria-label="Primary">
          <a class="${active("home")}" href="${basePrefix}index.html">Home</a>
          <a class="${active("story")}" href="${basePrefix}story.html">Our Story</a>
          <a class="${active("contact")}" href="${basePrefix}contact.html">Contact</a>
        </nav>
      </header>
    `;
  }

  function footerTemplate() {
    return `
      <footer class="site-footer">
        <div>
          <h4>Antariya</h4>
          <p>A Premium Embroidery Marketplace</p>
        </div>
        <div class="footer-links">
          <a href="${basePrefix}story.html">Our Story</a>
          <a href="${basePrefix}contact.html">Contact</a>
          <a href="${basePrefix}legal/privacy.html">Privacy Policy</a>
          <a href="${basePrefix}legal/terms.html">Terms & Conditions</a>
          <a href="${basePrefix}legal/shipping.html">Shipping Policy</a>
          <a href="${basePrefix}legal/returns.html">Returns & Refund Policy</a>
        </div>
      </footer>
    `;
  }

  function setupRevealAnimations() {
    const reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    reveals.forEach((el, index) => {
      el.style.transitionDelay = `${Math.min(index * 40, 180)}ms`;
      observer.observe(el);
    });
  }

  function injectShell() {
    const navTarget = document.querySelector("[data-navbar]");
    const footerTarget = document.querySelector("[data-footer]");

    if (navTarget) {
      navTarget.innerHTML = navbarTemplate();
    }

    if (footerTarget) {
      footerTarget.innerHTML = footerTemplate();
    }
  }

  function initTestimonials() {
    const holder = document.querySelector("[data-testimonials]");
    if (!holder) {
      return;
    }

    holder.innerHTML = data.testimonials
      .map(
        (item) => `
        <article class="testimonial-card reveal">
          <p>“${item.quote}”</p>
          <span>${item.author}</span>
        </article>
      `
      )
      .join("");
  }

  function initInstaGrid() {
    const grid = document.querySelector("[data-insta-grid]");
    if (!grid) {
      return;
    }

    const galleryImages = ["1.jpg", "2.jpg", "3.jpeg", "4.jpeg", "5.jpeg", "homepage.jpg"];

    grid.innerHTML = galleryImages
      .map(
        (image, idx) => `
        <a class="insta-tile reveal" href="story.html" aria-label="Instagram look ${idx + 1}" style="background-image:linear-gradient(155deg, rgba(16, 16, 16, 0.12), rgba(16, 16, 16, 0.38)), url('assets/images/${image}'); background-size:cover; background-position:center;">
          <span>@antariyaofficial</span>
        </a>
      `
      )
      .join("");
  }

  function initLaunchCountdown() {
    const countdown = document.querySelector("[data-countdown]");
    if (!countdown) {
      return;
    }

    const targetDate = countdown.getAttribute("data-target-date");
    const launchDate = targetDate ? new Date(targetDate).getTime() : NaN;
    if (Number.isNaN(launchDate)) {
      return;
    }

    const daysEl = document.querySelector("#days") || document.querySelector("#cd-days");
    const hoursEl = document.querySelector("#hours") || document.querySelector("#cd-hours");
    const minutesEl = document.querySelector("#minutes") || document.querySelector("#cd-minutes");
    const secondsEl = document.querySelector("#seconds") || document.querySelector("#cd-seconds");

    function updateCountdown() {
      const now = Date.now();
      const distance = launchDate - now;

      if (distance <= 0) {
        countdown.innerHTML = "<p class='waitlist-success'>Drop 1 is now live. Stay tuned for the next release.</p>";
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (daysEl) daysEl.textContent = String(days);
      if (hoursEl) hoursEl.textContent = String(hours);
      if (minutesEl) minutesEl.textContent = String(minutes);
      if (secondsEl) secondsEl.textContent = String(seconds);
    }

    updateCountdown();
    window.setInterval(updateCountdown, 1000);
  }

  function initWaitlistForms() {
    const forms = document.querySelectorAll("[data-waitlist-form]");
    if (!forms.length) {
      return;
    }

    const configuredApiBase = String(window.ANTARIYA_API_BASE || "").trim().replace(/\/$/, "");
    const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

    function resolveApiEndpoint() {
      if (configuredApiBase) {
        return `${configuredApiBase}/api/waitlist/subscribe`;
      }

      if (isLocalHost) {
        return "http://localhost:5001/api/waitlist/subscribe";
      }

      return `${window.location.origin}/api/waitlist/subscribe`;
    }

    forms.forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const success = form.parentElement.querySelector("[data-waitlist-success]");
        const submitButton = form.querySelector("button[type='submit']");

        const formData = new FormData(form);
        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim();

        if (!name || !email) {
          if (success) {
            success.hidden = false;
            success.textContent = "Please provide both name and email.";
            success.classList.add("waitlist-error");
          }
          return;
        }

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Submitting...";
        }

        try {
          const endpoint = resolveApiEndpoint();
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              email,
              source: document.body.getAttribute("data-page") || "website",
            }),
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload?.message || "Unable to join waitlist right now.");
          }

          if (success) {
            success.hidden = false;
            success.textContent = payload?.message || "You are on the waitlist. We will notify you before launch.";
            success.classList.remove("waitlist-error");
          }

          form.reset();
        } catch (error) {
          if (success) {
            success.hidden = false;
            success.textContent = error.message || "Unable to join waitlist right now.";
            success.classList.add("waitlist-error");
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Join Waitlist";
          }
        }
      });
    });
  }

  function init() {
    injectShell();
    initTestimonials();
    initInstaGrid();
    initLaunchCountdown();
    initWaitlistForms();

    requestAnimationFrame(() => {
      document.body.classList.remove("preload");
      setupRevealAnimations();
    });
  }

  window.Antariya = {
    formatPrice
  };

  document.addEventListener("DOMContentLoaded", init);
})();
