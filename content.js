const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// React-controlled inputs ignore plain .value = ...
function setReactInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  input.focus();
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findSkillInput() {
  const selectors = [
    "input[id*='skills' i]",
    "input[placeholder*='Add Skills' i]",
    "input[placeholder*='Type to Add' i]",
    "input[placeholder*='skill' i]",
    "input[aria-label*='skill' i]",
    "[data-automation-id*='skill' i] input",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.offsetParent) return el;
  }
  return null;
}

function getAlreadyAddedSkills() {
  return new Set(
    [...document.querySelectorAll(
      '[data-automation-id*="selectedItem"], [class*="pill"], [class*="chip"]'
    )]
      .map(el => el.textContent.trim().toLowerCase())
      .filter(Boolean)
  );
}

function waitForOptions(timeoutMs = 4000) {
  const optionSelectors = [
    '[data-automation-id="promptOption"]',
    '[role="option"]',
    '[data-automation-id="listItem"]',
  ];
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      for (const sel of optionSelectors) {
        const opts = [...document.querySelectorAll(sel)]
          .filter(el => el.offsetParent);
        if (opts.length) {
          clearInterval(timer);
          resolve(opts);
          return;
        }
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve([]);
      }
    }, 100);
  });
}

function findBestMatch(options, skill) {
  const skillLc = skill.toLowerCase();
  return options.find(opt => {
    const text = opt.textContent.trim().toLowerCase();
    if (!text || text.includes('search result')) return false;
    return text.includes(skillLc) || skillLc.includes(text);
  });
}

function closeDropdown(input) {
  const rect = input.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = Math.max(10, rect.top - 80);
  const target = document.elementFromPoint(x, y);
  target?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
  target?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
}

async function addOneSkill(skill, alreadyAdded) {
  if (alreadyAdded.has(skill.toLowerCase())) {
    return { skill, status: 'skipped', reason: 'already added' };
  }

  const input = findSkillInput();
  if (!input) return { skill, status: 'error', reason: 'skills input not found' };

  input.scrollIntoView({ block: 'center' });
  input.click();
  await sleep(200);

  setReactInputValue(input, skill);
  await sleep(300);

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  await sleep(500);

  const options = await waitForOptions();
  if (!options.length) {
    closeDropdown(input);
    return { skill, status: 'error', reason: 'no dropdown options' };
  }

  const match = findBestMatch(options, skill);
  if (!match) {
    closeDropdown(input);
    return { skill, status: 'error', reason: 'no matching option' };
  }

  const checkbox = match.querySelector('input[type="checkbox"]');
  (checkbox ?? match).click();
  await sleep(300);

  closeDropdown(input);
  await sleep(200);
  return { skill, status: 'added', matched: match.textContent.trim() };
}

async function fillAllSkills(skills) {
  const alreadyAdded = getAlreadyAddedSkills();
  const results = [];

  for (const skill of skills) {
    const result = await addOneSkill(skill, alreadyAdded);
    results.push(result);
    if (result.status === 'added') {
      alreadyAdded.add(skill.toLowerCase());
    }
    await sleep(400);
  }

  const added = results.filter(r => r.status === 'added').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'error');

  return {
    message: `Added ${added}, skipped ${skipped}, failed ${failed.length}`,
    results,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'fillSkills') {
    fillAllSkills(msg.skills).then(sendResponse);
    return true;
  }
});
