const skillsEl = document.getElementById('skills');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(['skills'], ({ skills = [] }) => {
  skillsEl.value = skills.join('\n');
});

document.getElementById('save').addEventListener('click', () => {
  const skills = skillsEl.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  chrome.storage.sync.set({ skills }, () => {
    statusEl.textContent = `Saved ${skills.length} skills.`;
  });
});

document.getElementById('fill').addEventListener('click', async () => {
  const skills = skillsEl.value.split('\n').map(s => s.trim()).filter(Boolean);
  await chrome.storage.sync.set({ skills });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'fillSkills', skills });
    statusEl.textContent = response?.message ?? 'Done!';
  } catch {
    statusEl.textContent = 'Open a Workday application page first, then try again.';
  }
});
