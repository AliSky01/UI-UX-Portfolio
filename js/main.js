const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  document.addEventListener("scroll", onScroll, { passive: true });
}

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  });
}

const links = [...document.querySelectorAll(".site-nav a")];

if (links.length && "IntersectionObserver" in window) {
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;
        links.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === id);
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((section) => spy.observe(section));
}

const studies = {
  connect: {
    kicker: "Mobile app · Campus",
    title: "NU Connect",
    summary:
      "A campus companion that puts today’s schedule, org news, and announcements in one calm feed.",
    role: "UI/UX design",
    tools: "Figma, FigJam",
    type: "Student project",
    problem:
      "Class reminders, org signups, and announcements were scattered across group chats, so students missed the things that mattered that day.",
    points: [
      "Designed a home feed grouped around what is happening today, not a pile of old messages.",
      "Built a weekly schedule with subject, room, and a clear empty state.",
      "Shortened the org join flow from four taps to two after trying it with classmates.",
    ],
  },
  brew: {
    kicker: "Mobile app · Ordering",
    title: "Brew & Co.",
    summary:
      "A three-screen ordering flow for a neighborhood café, made to be used one-handed while standing in line.",
    role: "UI/UX design",
    tools: "Figma, Photoshop",
    type: "Concept project",
    problem:
      "The lunch rush hid the menu behind the counter, and custom drinks took too long to explain out loud.",
    points: [
      "Designed a visual menu with short labels and dietary tags.",
      "Kept customization on one screen, with the total always visible.",
      "Added a pickup status screen so guests know when to walk up.",
    ],
  },
  study: {
    kicker: "Web app · Productivity",
    title: "StudyLane",
    summary:
      "A weekly focus planner that asks for one priority a day, then gets out of the way.",
    role: "UI/UX design",
    tools: "Figma, HTML & CSS",
    type: "Student project",
    problem:
      "Most study plans fail because they are too vague to start and too harsh when a day gets missed.",
    points: [
      "Designed a weekly board with a single priority for each day.",
      "Tied a focus timer to that priority so starting is the same click every time.",
      "Wrote the recap around what was finished, instead of highlighting missed days.",
    ],
  },
};

const dialog = document.querySelector("#case-dialog");

function fillStudy(study) {
  document.querySelector("#case-kicker").textContent = study.kicker;
  document.querySelector("#case-title").textContent = study.title;
  document.querySelector("#case-summary").textContent = study.summary;
  document.querySelector("#case-role").textContent = study.role;
  document.querySelector("#case-tools").textContent = study.tools;
  document.querySelector("#case-type").textContent = study.type;
  document.querySelector("#case-problem").textContent = study.problem;

  const list = document.querySelector("#case-points");
  list.replaceChildren();
  study.points.forEach((point) => {
    const item = document.createElement("li");
    item.textContent = point;
    list.append(item);
  });
}

if (dialog) {
  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => {
      const study = studies[card.dataset.project];
      if (!study) return;
      fillStudy(study);
      dialog.showModal();
    });
  });

  dialog.querySelector(".case-close")?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
}

document.querySelector("[data-print]")?.addEventListener("click", () => window.print());

const helloWord = document.querySelector("#hello-word");
const helloSlot = document.querySelector(".hello-slot");

if (helloWord && helloSlot) {
  const greetings = [
    "Hello",
    "Kumusta",
    "Hola",
    "Bonjour",
    "Ciao",
    "Hallo",
    "Olá",
    "こんにちは",
    "안녕하세요",
    "你好",
    "Namaste",
    "Xin chào",
    "مرحبا",
    "Sawasdee",
  ];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;

  const fit = () => {
    helloSlot.style.width = `${helloWord.getBoundingClientRect().width}px`;
  };

  fit();
  document.fonts?.ready.then(fit);

  if (!reduced) {
    window.setInterval(() => {
      helloWord.classList.add("is-out");
      window.setTimeout(() => {
        index = (index + 1) % greetings.length;
        helloWord.textContent = greetings[index];
        helloWord.classList.remove("is-out");
        helloWord.classList.add("is-in");
        fit();
        window.setTimeout(() => helloWord.classList.remove("is-in"), 320);
      }, 280);
    }, 2200);
  }
}

const hanger = document.querySelector(".id-hanger");

if (hanger) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode = reduced ? "rest" : "idle";
  let angle = 0;
  let velocity = 0;

  const paint = () => {
    hanger.style.transform = `rotate(${angle}deg)`;
  };

  const frame = (now) => {
    if (mode === "idle") {
      angle = Math.sin(now / 720) * 3.4;
      paint();
    } else if (mode === "settle") {
      velocity += -angle * 0.14;
      velocity *= 0.8;
      angle += velocity;
      if (Math.abs(angle) < 0.2 && Math.abs(velocity) < 0.2) {
        angle = 0;
        velocity = 0;
        mode = reduced ? "rest" : "idle";
      }
      paint();
    }
    requestAnimationFrame(frame);
  };

  const pointToAngle = (event) => {
    const rect = hanger.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = Math.max(48, event.clientY - rect.top);
    return Math.max(-42, Math.min(42, Math.atan2(dx, dy) * (180 / Math.PI)));
  };

  hanger.addEventListener("pointerdown", (event) => {
    mode = "drag";
    velocity = 0;
    hanger.classList.add("is-dragging");
    hanger.setPointerCapture(event.pointerId);
    angle = pointToAngle(event);
    paint();
  });

  hanger.addEventListener("pointermove", (event) => {
    if (mode !== "drag") return;
    const next = pointToAngle(event);
    velocity = next - angle;
    angle = next;
    paint();
  });

  const release = () => {
    if (mode !== "drag") return;
    hanger.classList.remove("is-dragging");
    mode = "settle";
  };

  hanger.addEventListener("pointerup", release);
  hanger.addEventListener("pointercancel", release);

  hanger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    velocity = event.key === "ArrowLeft" ? -10 : 10;
    angle = velocity;
    mode = "settle";
  });

  requestAnimationFrame(frame);
}
