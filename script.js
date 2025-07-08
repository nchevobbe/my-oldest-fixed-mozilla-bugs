const BUGZILLA_API_URL = "https://bugzilla.mozilla.org/rest/";

const form = document.querySelector("form");
const oldestList = document.querySelector("ul.oldest");
const longestList = document.querySelector("ul.longest");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  onFormSubmit();
});

const searchParams = new URLSearchParams(document.location.search);
const email = atob(searchParams.get("u"));
if (email && email.includes("@")) {
  form.querySelector("input").value = email;
  onFormSubmit(false);
}

async function onFormSubmit(appendEmail = true) {
  document.body.classList.add("loading");

  const email = new FormData(form).get("email");
  if (appendEmail) {
    history.pushState(
      {},
      "Oldest fixed bugs by " + email,
      location.protocol + location.pathname + "?u=" + btoa(email)
    );
  }

  const bugs = await getAllBugs(email);

  const longest = [];
  const oldest = [];
  for (const bug of bugs) {
    const { creation_time, cf_last_resolved } = bug;

    if (!cf_last_resolved || !creation_time) {
      continue;
    }

    const creation = parseBugTime(creation_time);
    const resolution = parseBugTime(cf_last_resolved);

    const item = {
      creation,
      resolution,
      creation_time,
      cf_last_resolved,
      diff: resolution.diff(creation),
      summary: bug.summary,
      id: bug.id,
      url: `https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.id}`,
    };

    if (longest.length < 5) {
      longest.push(item);
      longest.sort((a, b) => (a.diff > b.diff ? -1 : 1));
    } else {
      let index;
      if (
        longest.some((b, i) => {
          if (item.diff > b.diff) {
            index = i;
            return true;
          }
          return false;
        })
      ) {
        longest.splice(index, 0, item);
        longest.pop();
      }
    }

    if (oldest.length < 5) {
      oldest.push(item);
      oldest.sort((a, b) => (a.creation_time < b.creation_time ? -1 : 1));
    } else {
      let index;
      if (
        oldest.some((b, i) => {
          if (item.creation_time < b.creation_time) {
            index = i;
            return true;
          }
          return false;
        })
      ) {
        oldest.splice(index, 0, item);
        oldest.pop();
      }
    }
  }

  const oldestFragment = document.createDocumentFragment();
  oldest.forEach((bug) => {
    const li = document.createElement("li");

    const date = document.createElement("span");
    date.textContent = bug.creation.format("YYYY-MM-DD");
    date.classList.add("date");

    const bugEl = document.createElement("a");
    bugEl.href = bug.url;
    bugEl.textContent = `Bug ${bug.id} - ${bug.summary}`;

    li.append(date, bugEl);
    oldestFragment.appendChild(li);
  });

  const longestFragment = document.createDocumentFragment();
  for (const bug of longest) {
    const diffDuration = moment.duration(bug.diff);
    const years = diffDuration.years();
    const months = diffDuration.months();
    const days = diffDuration.days();
    const li = document.createElement("li");

    const date = document.createElement("span");
    date.textContent = bug.resolution.format("YYYY-MM-DD");
    date.classList.add("date");

    const yearsEl = document.createElement("span");
    yearsEl.classList.add("years");
    yearsEl.textContent = years + " years";

    const monthsEl = document.createElement("span");
    monthsEl.classList.add("months");
    monthsEl.textContent = months + " months";

    const daysEl = document.createElement("span");
    daysEl.classList.add("days");
    daysEl.textContent = days + " days";

    const bugEl = document.createElement("a");
    bugEl.href = bug.url;
    bugEl.textContent = `Bug ${bug.id} - ${bug.summary}`;

    li.append(date, bugEl, yearsEl, monthsEl, daysEl);

    longestFragment.appendChild(li);
  }

  document.body.classList.remove("loading");
  document.body.classList.add("loaded");
  form.querySelectorAll("input").forEach((input) => (input.disabled = false));
  oldestList.appendChild(oldestFragment);
  longestList.appendChild(longestFragment);
}

async function getAllBugs(email) {
  let allBugs = [];
  const limit = 500;
  const getParams = (offset) => {
    const x = new URLSearchParams({
      status: "RESOLVED",
      resolution: "FIXED",
      offset: offset || 0,
      limit,
      email1: email,
      emailassigned_to1: 1,
      include_fields: "id,summary,creation_time,cf_last_resolved",
    });

    x.append("status", "VERIFIED");
    x.append("status", "RESOLVED");
    return x;
  };

  let bugs;
  let offset = 0;
  while (!bugs || bugs.length === limit) {
    const response = await fetch(BUGZILLA_API_URL + "bug?" + getParams(offset));
    ({ bugs } = await response.json());
    allBugs = allBugs.concat(bugs);
    offset += limit;
  }
  return allBugs;
}

function parseBugTime(str) {
  const [date] = str.split("T");
  return moment(date, "YYYY-MM-DD");
}
