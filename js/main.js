document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  const whatsappPhone = (form?.dataset.whatsapp || "").replace(/[\s()-]/g, "").replace(/^\+/, "").replace(/^0(?=8)/, "62");
  const whatsappUrl = /^[1-9]\d{6,14}$/.test(whatsappPhone) && whatsappPhone !== "6281234567890"
    ? `https://wa.me/${whatsappPhone}`
    : "";

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Tutup navigasi" : "Buka navigasi");
    });
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Buka navigasi");
      });
    });
  }

  const siteHeader = document.querySelector(".site-header");
  if (navLinks && siteHeader) {
    const sectionLinks = [...navLinks.querySelectorAll('a[href^="#"]:not(.nav-cta)')]
      .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
      .filter(({ section }) => section);
    let activeLink = navLinks.querySelector('[aria-current="location"]');

    const updateActiveSection = () => {
      const anchorOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const readingLine = Math.max(anchorOffset, siteHeader.getBoundingClientRect().bottom) + 4;
      let nextLink = sectionLinks[0]?.link;
      let closestTop = -Infinity;

      for (const { link, section } of sectionLinks) {
        const top = section.getBoundingClientRect().top;
        if (top <= readingLine && top > closestTop) {
          nextLink = link;
          closestTop = top;
        }
      }

      if (!nextLink || nextLink === activeLink) return;

      activeLink?.classList.remove("active");
      activeLink?.removeAttribute("aria-current");
      nextLink.classList.add("active");
      nextLink.setAttribute("aria-current", "location");
      activeLink = nextLink;
    };

    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    window.addEventListener("pageshow", updateActiveSection);
    updateActiveSection();
  }

  // Tombol produk akan otomatis memilih produk pada formulir kontak.
  document.querySelectorAll("[data-product]").forEach((link) => {
    link.addEventListener("click", () => {
      const serviceSelect = document.getElementById("service");
      if (serviceSelect) {
        const product = link.dataset.product;
        const matchingOption = [...serviceSelect.options].find((option) => option.text === product);
        if (matchingOption) {
          serviceSelect.value = matchingOption.value;
          serviceSelect.setCustomValidity("");
        }
      }
    });
  });

  if (form) {
    form.querySelectorAll("[data-required-message]").forEach((field) => {
      field.addEventListener("invalid", () => {
        if (field.validity.valueMissing) field.setCustomValidity(field.dataset.requiredMessage);
      });
      field.addEventListener("input", () => field.setCustomValidity(""));
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const company = String(data.get("company") || "").trim();
      const service = String(data.get("service") || "").trim();
      const message = String(data.get("message") || "").trim();
      if (!whatsappUrl) {
        alert("Nomor WhatsApp perusahaan belum tersedia. Silakan gunakan kontak email yang tercantum.");
        return;
      }

      const text = [
        "Halo, saya ingin konsultasi proteksi kebakaran.",
        `Nama: ${name}`,
        company ? `Perusahaan: ${company}` : "",
        `Kebutuhan: ${service}`,
        `Detail: ${message}`
      ].filter(Boolean).join("\n");

      window.open(`${whatsappUrl}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    });
  }

  const floatingWhatsapp = document.getElementById("floatingWhatsapp");
  if (floatingWhatsapp && whatsappUrl) {
    floatingWhatsapp.href = whatsappUrl;
    floatingWhatsapp.target = "_blank";
    floatingWhatsapp.rel = "noopener noreferrer";
  }
});
